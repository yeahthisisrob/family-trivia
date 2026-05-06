// File: lambda/routes/photoAlbums.ts
// Photo album links — list of external Google Photos (or other)
// shared album URLs that the family can browse from inside the app.
// Anyone signed in can add an album. Editing/deleting is restricted to
// the original creator OR an admin (for moderation).

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';
import { writeAlbumAddedNotification } from '../services/notificationService';
import { getJson, putJson } from '../services/s3';
import { getUserConfig } from '../services/users';

export interface PhotoAlbum {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdBy: string;
  createdAt: string;
  /** ISO timestamp of last edit, if any */
  updatedAt?: string;
}

interface PhotoAlbumsData {
  albums: PhotoAlbum[];
  lastUpdated: string;
}

const URL_PATTERN = /^https?:\/\/.+/i;

function getRequestUserId(event: APIGatewayProxyEvent): string | undefined {
  const fromQuery = event.queryStringParameters?.userId;
  if (fromQuery) return fromQuery;
  if (event.body) {
    try {
      const body = JSON.parse(event.body);
      return body.userId || body.adminUserId;
    } catch { /* ignore */ }
  }
  return undefined;
}

async function isAdmin(userId: string): Promise<boolean> {
  try {
    const config = await getUserConfig();
    return !!(config?.users[userId] as { isAdmin?: boolean } | undefined)?.isAdmin;
  } catch {
    return false;
  }
}

async function loadAlbums(): Promise<PhotoAlbumsData> {
  try {
    const existing = await getJson<PhotoAlbumsData>(S3_PATHS.PHOTO_ALBUMS);
    if (existing && Array.isArray(existing.albums)) return existing;
  } catch { /* file doesn't exist yet */ }
  return { albums: [], lastUpdated: new Date().toISOString() };
}

async function saveAlbums(data: PhotoAlbumsData): Promise<void> {
  data.lastUpdated = new Date().toISOString();
  await putJson(S3_PATHS.PHOTO_ALBUMS, data);
}

function sortNewestFirst(albums: PhotoAlbum[]): PhotoAlbum[] {
  return [...albums].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ── GET /photo-albums ───────────────────────────────────────────────
// Open to any authenticated user.

export async function listPhotoAlbums(
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const data = await loadAlbums();
    return successResponse({ albums: sortNewestFirst(data.albums) });
  } catch (err) {
    logger.error('Failed to list photo albums', { err });
    return errorResponse('Failed to load photo albums', 500);
  }
}

// ── POST /photo-albums ──────────────────────────────────────────────
// Any authenticated user can add an album.
// Body: { userId, name, description?, url }

export async function addPhotoAlbum(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = getRequestUserId(event);
  if (!userId) return errorResponse('userId is required', 400);

  try {
    const body = JSON.parse(event.body || '{}');
    const { name, description, url } = body as {
      name?: string;
      description?: string;
      url?: string;
    };

    if (!name || !name.trim()) return errorResponse('name is required', 400);
    if (!url || !URL_PATTERN.test(url)) return errorResponse('A valid url is required', 400);

    const data = await loadAlbums();
    const album: PhotoAlbum = {
      id: `alb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      description: description?.trim() || undefined,
      url: url.trim(),
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    data.albums.push(album);
    await saveAlbums(data);
    // Fire-and-forget notification for the rest of the family.
    await writeAlbumAddedNotification(album.id, album.name, userId);
    logger.info('Photo album added', { id: album.id, by: userId });
    return successResponse({ album });
  } catch (err) {
    logger.error('Failed to add photo album', { err });
    return errorResponse('Failed to add photo album', 500);
  }
}

// ── PUT /photo-albums ───────────────────────────────────────────────
// Owner or admin. Body: { userId, id, name?, description?, url? }

export async function updatePhotoAlbum(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = getRequestUserId(event);
  if (!userId) return errorResponse('userId is required', 400);

  try {
    const body = JSON.parse(event.body || '{}');
    const { id, name, description, url } = body as {
      id?: string;
      name?: string;
      description?: string;
      url?: string;
    };
    if (!id) return errorResponse('id is required', 400);
    if (url !== undefined && !URL_PATTERN.test(url)) {
      return errorResponse('url must be a valid http(s) URL', 400);
    }

    const data = await loadAlbums();
    const idx = data.albums.findIndex(a => a.id === id);
    if (idx < 0) return errorResponse('Album not found', 404);

    const current = data.albums[idx];
    if (current.createdBy !== userId && !(await isAdmin(userId))) {
      return errorResponse('You can only edit albums you added', 403);
    }
    data.albums[idx] = {
      ...current,
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description: description.trim() || undefined }),
      ...(url !== undefined && { url: url.trim() }),
      updatedAt: new Date().toISOString(),
    };
    await saveAlbums(data);
    logger.info('Photo album updated', { id, by: userId });
    return successResponse({ album: data.albums[idx] });
  } catch (err) {
    logger.error('Failed to update photo album', { err });
    return errorResponse('Failed to update photo album', 500);
  }
}

// ── DELETE /photo-albums?id=...&userId=... ──────────────────────────
// Owner or admin.

export async function deletePhotoAlbum(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = getRequestUserId(event);
  if (!userId) return errorResponse('userId is required', 400);

  try {
    const id = event.queryStringParameters?.id;
    if (!id) return errorResponse('id is required', 400);

    const data = await loadAlbums();
    const target = data.albums.find(a => a.id === id);
    if (!target) return errorResponse('Album not found', 404);

    if (target.createdBy !== userId && !(await isAdmin(userId))) {
      return errorResponse('You can only delete albums you added', 403);
    }

    data.albums = data.albums.filter(a => a.id !== id);
    await saveAlbums(data);
    logger.info('Photo album deleted', { id, by: userId });
    return successResponse({ success: true });
  } catch (err) {
    logger.error('Failed to delete photo album', { err });
    return errorResponse('Failed to delete photo album', 500);
  }
}
