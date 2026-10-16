import { requireAuth } from '../../middleware/requireAuth';
import { getFamily, getFamilyStory, getWords, refreshFamilyStory, saveFamily } from './handlers';

/** The family slice's routes, merged into the router in index.ts. */
export const familyRoutes = {
  'GET /family': requireAuth(getFamily),
  'PUT /admin/family': requireAuth(saveFamily),
  'GET /family/story': requireAuth(getFamilyStory),
  'POST /admin/family/story': requireAuth(refreshFamilyStory),
  'GET /family/words': requireAuth(getWords),
};
