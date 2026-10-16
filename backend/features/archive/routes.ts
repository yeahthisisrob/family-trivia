import { requireAuth } from '../../middleware/requireAuth';
import {
  archiveOptions,
  exportArchive,
  getExportPermissions,
  saveExportPermissions,
} from './handlers';

export const archiveRoutes = {
  'GET /archive/options': requireAuth(archiveOptions),
  'POST /archive/export': requireAuth(exportArchive),
  'GET /admin/archive/permissions': requireAuth(getExportPermissions),
  'PUT /admin/archive/permissions': requireAuth(saveExportPermissions),
};
