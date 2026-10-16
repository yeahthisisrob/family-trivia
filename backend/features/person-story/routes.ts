import { requireAuth } from '../../middleware/requireAuth';
import { listPersonBooks, makePersonBook } from './bookHandler';
import { getPersonStory } from './handlers';

export const personStoryRoutes = {
  'GET /family/person-story': requireAuth(getPersonStory),
  'POST /family/person-book': requireAuth(makePersonBook),
  'GET /family/person-book/versions': requireAuth(listPersonBooks),
};
