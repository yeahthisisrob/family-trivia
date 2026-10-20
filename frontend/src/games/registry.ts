/**
 * Every game in src/games, found at build time (docs/decisions/0032): each
 * folder's index.tsx default-exports defineGame({...}). Nothing here names a
 * game; adding a folder adds the game.
 */
import { gameModeOf, type HistoryEntry } from '@family-trivia/shared';
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

type Playable = Game & { Play: NonNullable<Game['Play']> };

/** The Arcade's tiles: games with a Play of their own that no other game hosts. */
export const ARCADE: Playable[] = GAMES.filter((g): g is Playable => !!g.Play && !g.lobby);

/** The games another game hosts in its lobby (`lobby.of`). */
export const gamesIn = (host: string): Playable[] =>
  GAMES.filter((g): g is Playable => !!g.Play && g.lobby?.of === host);

/** Something that may have come from a game: a history entry, or a question with its mode. */
type FromAGame = Partial<HistoryEntry> & { mode?: string; question?: unknown };

/** The game an answer was played in, if any (its stored mode, or the question's). */
export function gameOf(entry: FromAGame | null | undefined): Game | undefined {
  if (!entry) return undefined;
  const q = entry.question as { mode?: string } | undefined;
  const id =
    gameModeOf(entry as HistoryEntry) ??
    entry.mode ??
    (q && typeof q === 'object' ? q.mode : undefined);
  return id ? gameById(id) : undefined;
}
