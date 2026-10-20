import { requireAuth } from '../../middleware/requireAuth';
import {
  getCircles,
  getMyCircles,
  getSetup,
  joinCircle,
  postCircle,
  postJoin,
  postSplit,
  signIn,
  startFirst,
} from './handlers';

export const circlesRoutes = {
  // Without a token: it's how you get one.
  'POST /auth/google': signIn,
  'GET /setup': getSetup,
  'POST /auth/start': startFirst,
  'GET /me/circles': requireAuth(getMyCircles),
  'POST /me/circles': requireAuth(joinCircle),
  'GET /admin/circles': requireAuth(getCircles),
  'POST /admin/circles': requireAuth(postCircle),
  'POST /admin/circles/join': requireAuth(postJoin),
  'POST /admin/circles/split': requireAuth(postSplit),
};
