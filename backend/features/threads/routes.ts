import { requireAuth } from '../../middleware/requireAuth';
import { getThreadsToday, postThreadAnswer } from './handlers';

export const threadsRoutes = {
  'GET /threads/today': requireAuth(getThreadsToday),
  'POST /threads/answer': requireAuth(postThreadAnswer),
};
