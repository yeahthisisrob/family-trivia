import { requireAuth } from '../../middleware/requireAuth';
import {
  acceptInviteHandler,
  getInvite,
  getInvites,
  postDecideJoin,
  postInvite,
  postRevokeInvite,
} from './handlers';

export const invitesRoutes = {
  // Before sign-in: the link page. The token in the link is the secret.
  'GET /invite': getInvite,
  'POST /invite/accept': acceptInviteHandler,
  'GET /admin/invites': requireAuth(getInvites),
  'POST /admin/invites': requireAuth(postInvite),
  'POST /admin/invites/revoke': requireAuth(postRevokeInvite),
  'POST /admin/joins/decide': requireAuth(postDecideJoin),
};
