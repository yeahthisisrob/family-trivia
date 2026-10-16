vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

vi.hoisted(() => {
  process.env.BACKUP_BUCKET_NAME = 'backups';
});

// An in-memory S3 for the two buckets the backup touches.
const buckets = vi.hoisted(() => ({
  data: new Map<string, string>(),
  backup: new Map<string, string>(),
}));
vi.mock('@aws-sdk/client-s3', () => {
  class Cmd {
    constructor(public input: Record<string, string | number | undefined>) {}
  }
  class ListObjectsV2Command extends Cmd {}
  class CopyObjectCommand extends Cmd {}
  class PutObjectCommand extends Cmd {}
  const pick = (b: unknown) => (b === 'backups' ? buckets.backup : buckets.data);
  class S3Client {
    async send(c: Cmd) {
      const i = c.input;
      if (c instanceof ListObjectsV2Command) {
        const keys = [...pick(i.Bucket).keys()]
          .filter((k) => k.startsWith(String(i.Prefix ?? '')))
          .sort();
        const shown = i.MaxKeys ? keys.slice(0, Number(i.MaxKeys)) : keys;
        if (i.Delimiter) {
          const pre = new Set(
            shown.map((k) => k.slice(0, k.indexOf('/', String(i.Prefix).length) + 1)),
          );
          return { CommonPrefixes: [...pre].map((Prefix) => ({ Prefix })), KeyCount: pre.size };
        }
        return {
          Contents: shown.map((Key) => ({ Key, Size: pick(i.Bucket).get(Key)!.length })),
          KeyCount: shown.length,
        };
      }
      if (c instanceof CopyObjectCommand) {
        const src = decodeURIComponent(String(i.CopySource).split('/').slice(1).join('/'));
        buckets.backup.set(String(i.Key), buckets.data.get(src)!);
        return {};
      }
      if (c instanceof PutObjectCommand) {
        pick(i.Bucket).set(String(i.Key), String(i.Body));
        return {};
      }
      throw new Error('unexpected command');
    }
  }
  return { S3Client, ListObjectsV2Command, CopyObjectCommand, PutObjectCommand };
});

import { handler } from '../features/backups/job';
import { listSnapshots, readStatus, snapshot } from '../features/backups/snapshot';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

beforeEach(() => {
  resetS3Mock();
  buckets.backup.clear();
  buckets.data.clear();
  buckets.data.set('facts/answers/alice.json', '[1]');
  buckets.data.set('media/photo one.jpg', 'jpg');
  buckets.data.set('exports/alice/x.zip', 'zip');
});

test('copies everything but download zips, checks it, and keeps one a month', async () => {
  const run = await snapshot('manual', 'alice', new Date('2026-10-16T08:00:00Z'));
  expect(run.ok).toBe(true);
  expect(run.objects).toBe(2);
  expect(run.monthly).toBe('monthly/2026-10/');
  expect(buckets.backup.has('daily/2026-10-16/media/photo one.jpg')).toBe(true);
  expect(buckets.backup.has('daily/2026-10-16/exports/alice/x.zip')).toBe(false);
  expect(buckets.backup.has('daily/2026-10-16/manifest.json')).toBe(true);

  const second = await snapshot('manual', 'alice', new Date('2026-10-17T08:00:00Z'));
  expect(second.monthly).toBeUndefined();
  expect(await listSnapshots()).toEqual({
    daily: ['2026-10-17', '2026-10-16'],
    monthly: ['2026-10'],
  });
  expect((await readStatus()).lastOk?.at).toBe('2026-10-17T08:00:00.000Z');
});

test('the nightly job does nothing until the family turns it on', async () => {
  expect(await handler()).toEqual({ ran: false });
  expect(buckets.backup.size).toBe(0);
  seedRaw('config/settings.json', { 'backups.automatic': true });
  expect(await handler()).toEqual({ ran: true, ok: true });
});
