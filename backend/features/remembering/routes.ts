import { requireAuth } from '../../middleware/requireAuth';
import { getRemembering } from './handlers';

export const rememberingRoutes = {
  'GET /family/remembering': requireAuth(getRemembering),
};
