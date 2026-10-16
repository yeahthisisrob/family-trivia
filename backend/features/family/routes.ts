import { requireAuth } from '../../middleware/requireAuth';
import { getFamily, saveFamily } from './handlers';

/** The family slice's routes, merged into the router in index.ts. */
export const familyRoutes = {
  'GET /family': requireAuth(getFamily),
  'PUT /admin/family': requireAuth(saveFamily),
};
