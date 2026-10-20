import { apiService } from '../../../shared/api/ApiService';

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

export interface BackupsView {
  last: BackupRun | null;
  lastOk: BackupRun | null;
  snapshots: { daily: string[]; monthly: string[] };
  automatic: boolean;
  configured: boolean;
}

export const backupsApi = {
  get: () => apiService.request<BackupsView>('/admin/backups', { method: 'GET' }),
  make: () => apiService.request<BackupRun>('/admin/backups', { method: 'POST' }),
};
