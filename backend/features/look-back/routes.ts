import { requireAuth } from '../../middleware/requireAuth';
import { getSeasonReview } from './handlers';

export const lookBackRoutes = {
  'GET /seasons/review': requireAuth(getSeasonReview),
};
