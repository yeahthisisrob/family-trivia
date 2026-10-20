import { requireAuth } from '../../middleware/requireAuth';
import { getClues, getSave, getScores, postScore, putSave } from './handlers';

export const gamesRoutes = {
  'GET /games/scores': requireAuth(getScores),
  'POST /games/scores': requireAuth(postScore),
  'GET /games/save': requireAuth(getSave),
  'PUT /games/save': requireAuth(putSave),
  'GET /games/clues': requireAuth(getClues),
};
