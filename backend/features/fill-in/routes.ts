import { requireAuth } from '../../middleware/requireAuth';
import { getFillIn, putFillIn } from './handlers';

export const fillInRoutes = {
  'GET /fill-in': requireAuth(getFillIn),
  'PUT /fill-in': requireAuth(putFillIn),
};
