import { requireAuth } from '../../middleware/requireAuth';
import {
  getClues,
  getRounds,
  getSave,
  getScores,
  postRoundAnswer,
  postRoundLock,
  postScore,
  putSave,
} from './handlers';

export const gamesRoutes = {
  'GET /games/scores': requireAuth(getScores),
  'POST /games/scores': requireAuth(postScore),
  'GET /games/save': requireAuth(getSave),
  'PUT /games/save': requireAuth(putSave),
  'GET /games/clues': requireAuth(getClues),
  'GET /games/rounds': requireAuth(getRounds),
  'POST /games/rounds/lock': requireAuth(postRoundLock),
  'POST /games/rounds/answer': requireAuth(postRoundAnswer),
};
