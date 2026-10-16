import { requireAuth } from '../../middleware/requireAuth';
import { getAdminSettings, getFeatures, putAdminSettings } from './handlers';

export const settingsRoutes = {
  'GET /settings/features': requireAuth(getFeatures),
  'GET /admin/settings': requireAuth(getAdminSettings),
  'PUT /admin/settings': requireAuth(putAdminSettings),
};
