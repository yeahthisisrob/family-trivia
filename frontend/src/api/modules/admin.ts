// Module: admin
// Photo uploads for admins (season letters, the family editor). Every other
// admin read and change is server data in its features/admin-* slice
// (docs/decisions/0035).

import { apiService } from '../../shared/api/ApiService';

// ── Media ────────────────────────────────────────────────────────

/**
 * Upload one image to the family's private storage and return its key.
 * The browser sends the file straight to S3 with a short-lived URL.
 */
export async function uploadImage(
  adminUserId: string,
  file: File,
  folder: string,
): Promise<string> {
  const { key, url } = await apiService.request<{ key: string; url: string }>(
    '/admin/media/upload-url',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUserId, contentType: file.type, folder }),
    },
  );
  const put = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);
  return key;
}
