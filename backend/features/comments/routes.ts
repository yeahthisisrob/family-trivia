import { requireAuth } from '../../middleware/requireAuth';
import { getComments, getCounts, postComment } from './handlers';

export const commentsRoutes = {
  'GET /comments': requireAuth(getComments),
  'GET /comments/counts': requireAuth(getCounts),
  'POST /comments': requireAuth(postComment),
};
