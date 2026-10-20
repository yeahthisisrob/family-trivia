/**
 * A game's server folder (docs/decisions/0032): backend/features/games/<id>/
 * with an index.ts that default-exports defineServerGame({...}). The folder
 * name is the game's id, the same as its folder in frontend/src/games.
 *
 * `routes` are the game's own endpoints, keyed by method and action
 * (`'POST climb'`); each is served at `/<id>/<action>` (`POST /word-ladder/climb`)
 * behind the usual sign-in. Everything else is read by the rest of the app
 * through services/gameRegistry.
 */
import type { AuthHandler } from '../../middleware/requireAuth';
import type { ServerGame } from '../../services/gameRegistry';

export interface GameFolder extends ServerGame {
  routes?: Record<`${'GET' | 'POST' | 'PUT' | 'DELETE'} ${string}`, AuthHandler>;
}

export const defineServerGame = (game: GameFolder): GameFolder => game;

/** Each folder route at its path: `'POST climb'` of word-ladder → `'POST /word-ladder/climb'`. */
export function routesOf(game: GameFolder): Record<string, AuthHandler> {
  return Object.fromEntries(
    Object.entries(game.routes ?? {}).map(([key, fn]) => {
      const [method, action] = key.split(' ');
      return [`${method} /${game.id}/${action}`, fn];
    }),
  );
}
