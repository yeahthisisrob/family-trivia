/**
 * Keeping books. A book is made again only when what it's made from changed
 * (its fingerprint) or someone asks; and nothing is ever replaced. Each PDF
 * is its own file under books/ (which the family's backups keep), beside the
 * input it was set from, and the record lists every version, newest first.
 *
 *   {prefix}.book.json            the record
 *   {prefix}/{madeAt}.pdf         each book
 *   {prefix}/{madeAt}.input.json  what it was set from
 */
import { createHash } from 'node:crypto';
import { downloadUrl } from '../media';
import { fileExists, getJson, putBytes, putJson } from '../s3';

export interface KeptVersion {
  madeAt: string;
  pages: number;
  key: string;
  inputKey: string;
  /** Its wraparound cover, when it has one. */
  coverKey?: string;
  /** Anything worth listing beside it (a tone, when its writing was written). */
  about?: Record<string, string | null>;
}

interface Record_ {
  fingerprint: string;
  versions: KeptVersion[];
}

export interface KeptBook {
  url: string;
  pages: number;
  madeAt: string;
  /** False when the kept copy was still current and nothing was made. */
  made: boolean;
  coverUrl?: string;
}

const coverName = (fileName: string) => fileName.replace(/\.pdf$/, ' - cover.pdf');

/** A time as it can sit in a file name. */
export const stamp = (iso: string) => iso.replace(/[:.]/g, '-');

export const fingerprintOf = (input: unknown) =>
  createHash('sha256').update(JSON.stringify(input)).digest('hex');

export async function keepBook(opts: {
  prefix: string;
  /** What the book is made from: kept beside it, and fingerprinted. */
  input: unknown;
  fileName: string;
  fresh?: boolean;
  about?: KeptVersion['about'];
  make: () => Promise<{ pdf: Buffer; pages: number }>;
  /** The cover, made for the book's page count. */
  cover?: (pages: number) => Promise<Buffer>;
}): Promise<KeptBook> {
  const recordKey = `${opts.prefix}.book.json`;
  const fingerprint = fingerprintOf(opts.input);
  const record = await getJson<Record_>(recordKey);
  const latest = record?.versions[0];
  if (
    !opts.fresh &&
    latest &&
    record?.fingerprint === fingerprint &&
    (await fileExists(latest.key))
  )
    return {
      url: await downloadUrl(latest.key, opts.fileName),
      pages: latest.pages,
      madeAt: latest.madeAt,
      made: false,
      ...(latest.coverKey
        ? { coverUrl: await downloadUrl(latest.coverKey, coverName(opts.fileName)) }
        : {}),
    };

  const madeAt = new Date().toISOString();
  const { pdf, pages } = await opts.make();
  const key = `${opts.prefix}/${stamp(madeAt)}.pdf`;
  const inputKey = `${opts.prefix}/${stamp(madeAt)}.input.json`;
  await putJson(inputKey, { madeAt, input: opts.input });
  await putBytes(key, pdf, 'application/pdf');
  const coverKey = opts.cover ? `${opts.prefix}/${stamp(madeAt)}.cover.pdf` : undefined;
  if (opts.cover && coverKey) await putBytes(coverKey, await opts.cover(pages), 'application/pdf');
  const version: KeptVersion = {
    madeAt,
    pages,
    key,
    inputKey,
    ...(coverKey ? { coverKey } : {}),
    ...(opts.about ? { about: opts.about } : {}),
  };
  await putJson(recordKey, { fingerprint, versions: [version, ...(record?.versions ?? [])] });
  return {
    url: await downloadUrl(key, opts.fileName),
    pages,
    madeAt,
    made: true,
    ...(coverKey ? { coverUrl: await downloadUrl(coverKey, coverName(opts.fileName)) } : {}),
  };
}

/** Every version kept under a prefix, newest first, each with a download link. */
export async function keptVersions(
  prefix: string,
  fileName: (v: KeptVersion) => string,
): Promise<(KeptVersion & { url: string; coverUrl?: string })[]> {
  const record = await getJson<Record_>(`${prefix}.book.json`);
  return Promise.all(
    (record?.versions ?? []).map(async (v) => ({
      ...v,
      url: await downloadUrl(v.key, fileName(v)),
      ...(v.coverKey ? { coverUrl: await downloadUrl(v.coverKey, coverName(fileName(v))) } : {}),
    })),
  );
}
