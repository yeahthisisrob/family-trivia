import { requireAuth } from '../../middleware/requireAuth';
import { listBookVersions, makeBookWriting, makeSeasonBook } from './bookHandler';
import { getSeasonReview } from './handlers';
import { getDailyMemory } from './memory';

export const lookBackRoutes = {
  'GET /seasons/review': requireAuth(getSeasonReview),
  'GET /family/memory': requireAuth(getDailyMemory),
  'POST /seasons/book': requireAuth(makeSeasonBook),
  'POST /seasons/book/writing': requireAuth(makeBookWriting),
  'GET /seasons/book/versions': requireAuth(listBookVersions),
};
