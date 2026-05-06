// File: lambda/services/s3.ts
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { BUCKET, REGION } from '../config';
import { logger } from './logger';

// Initialize S3 client
const s3 = new S3Client({
  region: REGION,
  maxAttempts: 3
});

// Per-request read cache — deduplicates concurrent getJson calls for the same key.
// Caches the Promise so parallel reads share one in-flight S3 request.
const readCache = new Map<string, Promise<any>>();

// Cross-invocation TTL cache for stable config files that rarely change.
// Survives warm Lambda containers — entries expire after TTL_MS.
const TTL_MS = 60_000; // 60 seconds
const STABLE_KEYS = new Set([
  'config/users.json',
  'family/hierarchy.json',
  'config/group_descriptions.json',
  'categories/categories.json',
  'config/seasons.json',
  'config/member-activation.json',
]);
const ttlCache = new Map<string, { data: any; expiresAt: number }>();

/** Clear the per-request read cache. Call at the start of every Lambda invocation. */
export function invalidateS3ReadCache(): void {
  readCache.clear();
  // TTL cache is intentionally NOT cleared — it survives across warm invocations
}

/**
 * Get JSON data from S3
 * @param key S3 object key
 * @returns Parsed JSON data or null if object doesn't exist
 */
export async function getJson<T>(key: string): Promise<T | null> {
  // 1. Check cross-invocation TTL cache for stable config files
  if (STABLE_KEYS.has(key)) {
    const cached = ttlCache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      logger.debug('S3 TTL cache hit', { key });
      return cached.data as T | null;
    }
  }

  // 2. Deduplicate concurrent reads for the same key within a single request
  if (readCache.has(key)) {
    logger.debug('S3 read cache hit', { key });
    return readCache.get(key)! as Promise<T | null>;
  }

  const promise = (async () => {
    const result = await getJsonUncached<T>(key);
    // Populate TTL cache on successful read of stable keys
    if (STABLE_KEYS.has(key)) {
      ttlCache.set(key, { data: result, expiresAt: Date.now() + TTL_MS });
    }
    return result;
  })();

  readCache.set(key, promise);

  // Remove from cache on error so retries aren't blocked
  promise.catch(() => readCache.delete(key));

  return promise;
}

async function getJsonUncached<T>(key: string): Promise<T | null> {
  logger.debug('Getting JSON from S3', { key });

  try {
    const resp = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key
    }));

    if (!resp.Body) {
      logger.warn('Empty S3 response body', { key, bucket: BUCKET });
      return null;
    }

    // Convert to string regardless of Body type
    const text = await resp.Body.transformToString();

    // Try to parse the JSON with error handling
    try {
      const parsed = JSON.parse(text) as T;

      // Check if parsed result is null or undefined
      if (parsed === null || parsed === undefined) {
        logger.warn('S3 JSON content is null or undefined', { key });
      }

      return parsed;
    } catch (parseError: any) {
      logger.error('Failed to parse S3 object as JSON', {
        key,
        error: parseError.message,
        preview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      });
      throw parseError;
    }
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      logger.debug('S3 object not found', { key, bucket: BUCKET });
      return null;
    }

    logger.error('S3 get error', {
      key,
      bucket: BUCKET,
      error: err.message,
      errorName: err.name,
      statusCode: err.$metadata?.httpStatusCode,
      requestId: err.$metadata?.requestId
    });
    throw err;
  }
}

/**
 * Store JSON data in S3
 * @param key S3 object key
 * @param data Data to store as JSON
 */
export async function putJson(key: string, data: any): Promise<void> {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }));

    // Bust TTL cache on write so admin changes take effect immediately
    if (STABLE_KEYS.has(key)) {
      ttlCache.delete(key);
    }

    logger.info('S3 write successful', { key });
  } catch (err: any) {
    logger.error('S3 put error', { 
      key, 
      error: err.message
    });
    throw err;
  }
}

/**
 * Store JSON data in S3 only if the key doesn't already exist (conditional put)
 * @param key S3 object key
 * @param data Data to store as JSON
 * @returns true if successfully written, false if object already exists
 */
export async function putJsonIfNotExists(key: string, data: any): Promise<boolean> {
  try {
    // Use IfNoneMatch condition to only write if object doesn't exist
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
      // This condition ensures the object is only created if it doesn't exist
      // The '*' means "if ETag doesn't match any value" = "if object doesn't exist"
      IfNoneMatch: '*',
    }));
    
    logger.info('S3 conditional write successful', { key });
    return true;
  } catch (err: any) {
    // PreconditionFailed means the object already exists
    if (err.name === 'PreconditionFailed' || err.$metadata?.httpStatusCode === 412) {
      logger.info('S3 object already exists, conditional write skipped', { key });
      return false;
    }
    
    logger.error('S3 conditional put error', { 
      key, 
      error: err.message,
      errorName: err.name,
      statusCode: err.$metadata?.httpStatusCode
    });
    throw err;
  }
}

/**
 * List objects in S3 with a specific prefix
 * @param prefix The prefix to filter objects by
 * @param maxKeys Maximum number of keys to return (default: 1000)
 * @returns Array of object keys
 */
export async function listObjects(prefix: string, maxKeys = 1000): Promise<string[]> {
  try {
    const objectKeys: string[] = [];
    let continuationToken: string | undefined;
    
    do {
      const response = await s3.send(new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix,
        MaxKeys: Math.min(1000, maxKeys - objectKeys.length),
        ContinuationToken: continuationToken
      }));
      
      response.Contents?.forEach(obj => {
        if (obj.Key) objectKeys.push(obj.Key);
      });
      
      continuationToken = response.NextContinuationToken;
    } while (continuationToken && objectKeys.length < maxKeys);
    
    logger.info('Listed S3 objects', { count: objectKeys.length, prefix });
    return objectKeys;
  } catch (err: any) {
    logger.error('S3 list error', { 
      prefix, 
      error: err.message
    });
    throw err;
  }
}

/**
 * Check if a file exists in S3
 * @param key The key to check
 * @returns boolean indicating if the file exists
 */
/**
 * Delete an object from S3
 * @param key S3 object key
 */
export async function deleteObject(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));

    logger.info('S3 delete successful', { key });
  } catch (err: any) {
    logger.error('S3 delete error', {
      key,
      error: err.message
    });
    throw err;
  }
}

/**
 * Check if a file exists in S3
 * @param key The key to check
 * @returns boolean indicating if the file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key
    }));
    return true;
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    logger.error('S3 head error', { 
      key, 
      error: err.message,
      statusCode: err.$metadata?.httpStatusCode
    });
    throw err;
  }
}