import { requireAuth } from '../../middleware/requireAuth';
import {
  getCircles,
  getMyCircles,
  getSame,
  getSetup,
  joinCircle,
  postCircle,
  postJoin,
  postSame,
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
  'GET /admin/circles/same': requireAuth(getSame),
  'POST /admin/circles/same': requireAuth(postSame),
};
