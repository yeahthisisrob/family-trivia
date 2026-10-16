import { requireAuth } from '../../middleware/requireAuth';
import { getPersonStory } from './handlers';

export const personStoryRoutes = {
  'GET /family/person-story': requireAuth(getPersonStory),
};
