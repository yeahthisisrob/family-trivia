import { requireAuth } from '../../middleware/requireAuth';
import { getGraph } from './handlers';

export const graphRoutes = {
  'GET /graph': requireAuth(getGraph),
};
