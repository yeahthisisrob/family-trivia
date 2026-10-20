import { requireAuth } from '../../middleware/requireAuth';
import { registerGame } from '../../services/gameRegistry';
import * as folders from './folders.generated';
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
import { type GameFolder, routesOf } from './kit';

// The games' server folders (docs/decisions/0032), each found by its folder.
export const GAME_FOLDERS: GameFolder[] = Object.values(folders);
for (const game of GAME_FOLDERS) registerGame(game);

export const gamesRoutes = {
  'GET /games/scores': requireAuth(getScores),
  'POST /games/scores': requireAuth(postScore),
  'GET /games/save': requireAuth(getSave),
  'PUT /games/save': requireAuth(putSave),
  'GET /games/clues': requireAuth(getClues),
  'GET /games/rounds': requireAuth(getRounds),
  'POST /games/rounds/lock': requireAuth(postRoundLock),
  'POST /games/rounds/answer': requireAuth(postRoundAnswer),
  // Each folder's own routes, at /<id>/<action>.
  ...Object.fromEntries(
    GAME_FOLDERS.flatMap((g) =>
      Object.entries(routesOf(g)).map(([route, fn]) => [route, requireAuth(fn)]),
    ),
  ),
};
