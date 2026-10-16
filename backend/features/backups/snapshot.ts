/**
 * Backups (docs/decisions/0014): a full copy of the family's data bucket in
 * a separate backups bucket. Each copy is checked (every object there) and
 * leaves a manifest; the last result is kept for Admin › Settings › Backups.
 *
 *   daily/YYYY-MM-DD/...   expires after 35 days (the bucket's lifecycle)
 *   monthly/YYYY-MM/...    the first copy of each month, kept for good
 *
 * Nothing here deletes or overwrites the family's data.
 */
import {
  CopyObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { BUCKET, REGION } from '../../config';
import { logger } from '../../services/logger';
import { getJson, putJson } from '../../services/s3';

const s3 = new S3Client({ region: REGION, maxAttempts: 3 });
export const BACKUP_BUCKET = process.env.BACKUP_BUCKET_NAME ?? '';
const STATUS_KEY = 'backups/status.json';
/** Download zips are made again on request; everything else is copied. */
const SKIP = ['exports/'];
const CONCURRENCY = 24;

export interface BackupRun {
  at: string;
  ok: boolean;
  trigger: 'manual' | 'automatic';
  by?: string;
  prefix?: string;
  objects?: number;
  bytes?: number;
  monthly?: string;
  error?: string;
}

export interface BackupStatus {
  last: BackupRun | null;
  lastOk: BackupRun | null;
}

interface Listed {
  key: string;
  size: number;
}

async function listAll(bucket: string, prefix = '', delimiter?: string) {
  const objects: Listed[] = [];
  const prefixes: string[] = [];
  let token: string | undefined;
  do {
    const r = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        Delimiter: delimiter,
        ContinuationToken: token,
      }),
    );
    for (const o of r.Contents ?? []) if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0 });
    for (const p of r.CommonPrefixes ?? []) if (p.Prefix) prefixes.push(p.Prefix);
    token = r.NextContinuationToken;
  } while (token);
  return { objects, prefixes };
}

async function anyUnder(bucket: string, prefix: string) {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 1 }));
  return (r.KeyCount ?? 0) > 0;
}

async function copyAll(keys: Listed[], to: string) {
  let next = 0;
  const worker = async () => {
    for (let item = keys[next++]; item; item = keys[next++]) {
      const { key } = item;
      await s3.send(
        new CopyObjectCommand({
          Bucket: BACKUP_BUCKET,
          Key: `${to}${key}`,
          CopySource: `${BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`,
        }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, keys.length) }, worker));
}

export const readStatus = async (): Promise<BackupStatus> =>
  (await getJson<BackupStatus>(STATUS_KEY)) ?? { last: null, lastOk: null };

/** Copy everything, check the copy, write the manifest and the status. */
export async function snapshot(
  trigger: BackupRun['trigger'],
  by?: string,
  now = new Date(),
): Promise<BackupRun> {
  const at = now.toISOString();
  const day = at.slice(0, 10);
  const month = at.slice(0, 7);
  const prefix = `daily/${day}/`;
  let run: BackupRun;
  try {
    if (!BACKUP_BUCKET) throw new Error('No backups bucket is set up (BACKUP_BUCKET_NAME)');
    const keys = (await listAll(BUCKET)).objects.filter(
      (o) => !SKIP.some((s) => o.key.startsWith(s)),
    );
    await copyAll(keys, prefix);

    const copied = (await listAll(BACKUP_BUCKET, prefix)).objects.filter(
      (o) => !o.key.endsWith('/manifest.json'),
    );
    if (copied.length < keys.length)
      throw new Error(`Only ${copied.length} of ${keys.length} files made it into the copy`);

    const hasMonthly = await anyUnder(BACKUP_BUCKET, `monthly/${month}/`);
    if (!hasMonthly) await copyAll(keys, `monthly/${month}/`);

    const bytes = keys.reduce((n, k) => n + k.size, 0);
    run = {
      at,
      ok: true,
      trigger,
      by,
      prefix,
      objects: keys.length,
      bytes,
      ...(hasMonthly ? {} : { monthly: `monthly/${month}/` }),
    };
    await s3.send(
      new PutObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: `${prefix}manifest.json`,
        ContentType: 'application/json',
        Body: JSON.stringify({ ...run, files: keys }, null, 2),
      }),
    );
    logger.info('Backup made', { prefix, objects: keys.length, bytes, trigger });
  } catch (err) {
    run = { at, ok: false, trigger, by, error: err instanceof Error ? err.message : String(err) };
    logger.error('Backup failed', { error: run.error, trigger });
  }
  const before = await readStatus();
  await putJson(STATUS_KEY, { last: run, lastOk: run.ok ? run : before.lastOk });
  return run;
}

/** The copies there are, newest first. */
export async function listSnapshots() {
  if (!BACKUP_BUCKET) return { daily: [], monthly: [] };
  const [daily, monthly] = await Promise.all([
    listAll(BACKUP_BUCKET, 'daily/', '/'),
    listAll(BACKUP_BUCKET, 'monthly/', '/'),
  ]);
  const names = (ps: string[], root: string) =>
    ps.map((p) => p.slice(root.length, -1)).sort((a, b) => b.localeCompare(a));
  return { daily: names(daily.prefixes, 'daily/'), monthly: names(monthly.prefixes, 'monthly/') };
}
