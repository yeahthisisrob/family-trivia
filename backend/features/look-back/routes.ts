import { requireAuth } from '../../middleware/requireAuth';
import { listBookVersions, makeBookWriting, makeSeasonBook } from './bookHandler';
import { getSeasonReview } from './handlers';

export const lookBackRoutes = {
  'GET /seasons/review': requireAuth(getSeasonReview),
  'POST /seasons/book': requireAuth(makeSeasonBook),
  'POST /seasons/book/writing': requireAuth(makeBookWriting),
  'GET /seasons/book/versions': requireAuth(listBookVersions),
};
