/**
 * Family photos and images (season letters, memorials). They live in the
 * family's own data bucket under `media/`, never in the public site bucket.
 * The browser uploads and reads them with short-lived presigned URLs, so the
 * bucket stays private and the Lambda never proxies image bytes.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { sourceOfKey } from '@family-trivia/shared';
import { BUCKET, REGION } from '../config';
import { findCircle, scopeOf } from './circles';
import { currentScope, inCircle, physicalKey } from './scope';

const s3 = new S3Client({ region: REGION });

const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;
export type ImageType = keyof typeof ALLOWED;
export const isImageType = (t: unknown): t is ImageType => typeof t === 'string' && t in ALLOWED;

/** A media key is always under media/, so a caller can't presign other data. */
export const isMediaKey = (key: unknown): key is string =>
  typeof key === 'string' && /^media\/[a-z0-9/_-]+\.(jpg|png|webp|gif)$/.test(key);

const UPLOAD_SECONDS = 300;
const READ_SECONDS = 3600;

export async function uploadUrl(
  folder: string,
  type: ImageType,
): Promise<{ key: string; url: string }> {
  const key = `media/${folder}/${crypto.randomUUID()}.${ALLOWED[type]}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: physicalKey(key), ContentType: type }),
    {
      expiresIn: UPLOAD_SECONDS,
    },
  );
  return { key, url };
}

/**
 * The stored key for a picture. One from a joined circle's source
 * (media/from/{circleId}/...) is read in that circle, and only from a
 * circle this one joins (docs/decisions/0018).
 */
async function storedKey(key: string): Promise<string | null> {
  const from = sourceOfKey(key);
  if (!from) return physicalKey(key);
  if (!currentScope().sources?.includes(from.circleId)) return null;
  const circle = await findCircle(from.circleId);
  return circle ? inCircle(scopeOf(circle), async () => physicalKey(from.key)) : null;
}

export async function readUrl(key: string): Promise<string | null> {
  if (!isMediaKey(key)) return null;
  const stored = await storedKey(key);
  if (!stored) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: stored }), {
    expiresIn: READ_SECONDS,
  });
}

/**
 * What may be handed out as a download: a family archive (exports/) or a
 * book and its cover (books/). Nothing else in the bucket.
 */
export const isDownloadKey = (key: string) =>
  /^exports\/[a-z0-9_-]+\/[\w-]+\.zip$/.test(key) ||
  /^books\/(season-\d+|people\/[a-z0-9_-]+)\/([a-z]+\/)?[\w-]+(\.cover)?\.pdf$/.test(key);

/** A short-lived link that downloads an export or a book as a named file. */
export async function downloadUrl(key: string, filename: string): Promise<string> {
  if (!isDownloadKey(key)) throw new Error('Not a downloadable key');
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: physicalKey(key),
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    }),
    { expiresIn: READ_SECONDS },
  );
}
