/**
 * Settings › Backups as server data (docs/decisions/0035, 0014): the last
 * backup, the copies kept, and making one now. Making one is never retried
 * (it copies everything); the view is asked again whether it finished or not,
 * so a failed run shows its reason.
 */
import { BACKUPS } from '../../../entities/settings';
import { callApi } from '../../../shared/api/contract';
import { useCircleInvalidate, useCircleMutation, useCircleQuery } from '../../../shared/api/query';

export const useBackups = () => useCircleQuery({ key: BACKUPS, path: '/admin/backups' });

export function useMakeBackup() {
  const invalidate = useCircleInvalidate();
  return useCircleMutation({
    mutationFn: async () => {
      try {
        return await callApi('/admin/backups', { method: 'post', once: true });
      } catch (e) {
        void invalidate(BACKUPS);
        throw e;
      }
    },
    invalidates: [BACKUPS],
    refreshInBackground: true,
  });
}
