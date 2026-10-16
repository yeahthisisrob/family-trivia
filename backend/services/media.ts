/**
 * Family photos and images (season letters, memorials). They live in the
 * family's own data bucket under `media/`, never in the public site bucket.
 * The browser uploads and reads them with short-lived presigned URLs, so the
 * bucket stays private and the Lambda never proxies image bytes.
 */
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BUCKET, REGION } from '../config';

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
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: type }),
    {
      expiresIn: UPLOAD_SECONDS,
    },
  );
  return { key, url };
}

export async function readUrl(key: string): Promise<string | null> {
  if (!isMediaKey(key)) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: READ_SECONDS,
  });
}
