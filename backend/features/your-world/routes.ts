import { requireAuth } from '../../middleware/requireAuth';
import { getWorld } from './handlers';

export const yourWorldRoutes = {
  'GET /me/world': requireAuth(getWorld),
};
