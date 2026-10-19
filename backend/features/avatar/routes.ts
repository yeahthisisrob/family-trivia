import { requireAuth } from '../../middleware/requireAuth';
import { postMakePicture, putMyAvatar } from './handlers';

export const avatarRoutes = {
  'PUT /me/avatar': requireAuth(putMyAvatar),
  'POST /me/avatar/make': requireAuth(postMakePicture),
};
