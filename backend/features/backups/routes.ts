import { requireAuth } from '../../middleware/requireAuth';
import { getBackups, makeBackup } from './handlers';

export const backupsRoutes = {
  'GET /admin/backups': requireAuth(getBackups),
  'POST /admin/backups': requireAuth(makeBackup),
};
