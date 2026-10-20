import { apiService } from '../../../shared/api/ApiService';

export interface ArchiveOptions {
  canExport: boolean;
  people: { id: string; name: string; remembered: boolean }[];
  households: { id: string; name: string; members: string[] }[];
}

export const archiveApi = {
  options: () =>
    apiService.request<ArchiveOptions>('/archive/options', { method: 'GET' }, undefined, true),
  export: (people: string[] | 'all') =>
    apiService.request<{ url: string; bytes: number; people: number }>('/archive/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ people }),
    }),
  permissions: () =>
    apiService.request<{ everyone: boolean; users: Record<string, boolean> }>(
      '/admin/archive/permissions',
      { method: 'GET' },
      undefined,
      true,
    ),
  savePermissions: (p: { everyone: boolean; users: Record<string, boolean> }) =>
    apiService.request('/admin/archive/permissions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    }),
};
