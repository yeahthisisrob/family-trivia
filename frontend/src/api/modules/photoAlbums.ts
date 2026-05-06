// Module: photoAlbums
// Admin-managed list of external shared album links (Google Photos, etc.)
// that the family can browse from inside the app.

import { apiService } from '../../services/ApiService';

export interface PhotoAlbum {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PhotoAlbumsResponse {
  albums: PhotoAlbum[];
}

export async function getPhotoAlbums(): Promise<PhotoAlbumsResponse> {
  return apiService.request<PhotoAlbumsResponse>(
    '/photo-albums',
    { method: 'GET' },
    'photo_albums',
  );
}

export async function addPhotoAlbum(
  userId: string,
  data: { name: string; description?: string; url: string },
): Promise<{ album: PhotoAlbum }> {
  return apiService.request<{ album: PhotoAlbum }>(
    '/photo-albums',
    {
      method: 'POST',
      body: JSON.stringify({ userId, ...data }),
    },
    undefined,
    true,
  );
}

export async function updatePhotoAlbum(
  userId: string,
  data: { id: string; name?: string; description?: string; url?: string },
): Promise<{ album: PhotoAlbum }> {
  return apiService.request<{ album: PhotoAlbum }>(
    '/photo-albums',
    {
      method: 'PUT',
      body: JSON.stringify({ userId, ...data }),
    },
    undefined,
    true,
  );
}

export async function deletePhotoAlbum(
  userId: string,
  id: string,
): Promise<{ success: boolean }> {
  return apiService.request<{ success: boolean }>(
    `/photo-albums?userId=${encodeURIComponent(userId)}&id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    undefined,
    true,
  );
}
