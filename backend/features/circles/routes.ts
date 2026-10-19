import { requireAuth } from '../../middleware/requireAuth';
import { getCircles, getMyCircles, joinCircle, postCircle, signIn } from './handlers';

export const circlesRoutes = {
  // The only route without a token: it's how you get one.
  'POST /auth/google': signIn,
  'GET /me/circles': requireAuth(getMyCircles),
  'POST /me/circles': requireAuth(joinCircle),
  'GET /admin/circles': requireAuth(getCircles),
  'POST /admin/circles': requireAuth(postCircle),
};
