import { requireAuth } from '../../middleware/requireAuth';
import { getReactions, putReaction } from './handlers';

export const reactionsRoutes = {
  'GET /reactions': requireAuth(getReactions),
  'PUT /reactions': requireAuth(putReaction),
};
