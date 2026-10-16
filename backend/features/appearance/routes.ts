import { requireAuth } from '../../middleware/requireAuth';
import { getAppearance, saveAppearance } from './handlers';

export const appearanceRoutes = {
  'GET /appearance': requireAuth(getAppearance),
  'PUT /admin/appearance': requireAuth(saveAppearance),
};
