/**
 * Who may download the family archive, as server data (docs/decisions/0035):
 * one read that Settings › Archive and the family editor share. A change
 * shows at once and is put back if it doesn't save; it only grants or takes
 * away the download, so it is safe to show early.
 */
import { callApi, type ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';

const PERMISSIONS = ['archive', 'permissions'] as const;

export type ExportPermissions = ResponseOf<'/admin/archive/permissions'>;

export const useArchivePermissions = () =>
  useCircleQuery({ key: PERMISSIONS, path: '/admin/archive/permissions' });

export const useSaveArchivePermissions = () =>
  useCircleMutation({
    mutationFn: (next: ExportPermissions) =>
      callApi('/admin/archive/permissions', { method: 'put', once: true, body: next }),
    onMutate: (next, cache) => {
      let before: ExportPermissions | undefined;
      cache.set<ExportPermissions>(PERMISSIONS, (current) => {
        before = current;
        return next;
      });
      return () => cache.set<ExportPermissions>(PERMISSIONS, () => before);
    },
    onSuccess: (saved, _next, cache) => cache.set(PERMISSIONS, () => saved),
  });
