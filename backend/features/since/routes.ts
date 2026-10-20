import { requireAuth } from '../../middleware/requireAuth';
import { postSince } from './handlers';

export const sinceRoutes = {
  'POST /me/since': requireAuth(postSince),
};
