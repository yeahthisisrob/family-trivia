import { requireAuth } from '../../middleware/requireAuth';
import { add, getAll, getUpcoming, remove } from './handlers';

export const celebrationsRoutes = {
  'GET /upcoming-birthdays': requireAuth(getUpcoming),
  'GET /celebrations': requireAuth(getAll),
  'POST /celebrations': requireAuth(add),
  'DELETE /celebrations': requireAuth(remove),
};
