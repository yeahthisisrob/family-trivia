/**
 * Every game in src/games, found at build time (docs/decisions/0032): each
 * folder's index.tsx default-exports defineGame({...}). Nothing here names a
 * game; adding a folder adds the game.
 */
import type { Game } from './kit';

const found = import.meta.glob<{ default: Game }>('./*/index.tsx', { eager: true });

export const GAMES: Game[] = Object.entries(found)
  .map(([path, mod]) => {
    const folder = path.split('/')[1];
    if (mod.default.id !== folder)
      throw new Error(`games/${folder}: id is "${mod.default.id}", it must be "${folder}"`);
    return mod.default;
  })
  .sort(
    (a, b) =>
      (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) ||
      a.label.localeCompare(b.label),
  );

export const gameById = (id: string): Game | undefined => GAMES.find((g) => g.id === id);
