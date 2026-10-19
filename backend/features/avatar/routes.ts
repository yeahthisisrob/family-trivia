import { requireAuth } from '../../middleware/requireAuth';
import { putMyAvatar } from './handlers';

export const avatarRoutes = {
  'PUT /me/avatar': requireAuth(putMyAvatar),
};
