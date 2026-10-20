/**
 * The server side of the games (docs/decisions/0032). A game that needs
 * anything on the server has a folder, backend/features/games/<id>/, whose
 * index.ts default-exports defineServerGame({...}). The games slice finds
 * the folders (features/games/folders.generated.ts) and registers each one
 * here. Whatever reads across games (app-init, the admin views, the archive,
 * the member summary, the leaderboard's podium points) asks this registry,
 * so nothing outside a game's folder names it.
 */
import type { HistoryEntry } from '@family-trivia/shared';

/** Can the player start the game's weekly play now, and is one under way. */
interface SessionStatus {
  canPlay: boolean;
  nextAvailable: Date | null;
  /** A play was started and not finished: opening the game resumes it. */
  active: boolean;
}

/** A play left open, for the admin overview of every player. */
export interface OpenSession {
  userId: string;
  status: string;
  questions: number;
  answered: number;
  startTime: string;
}

/** One player's state in the game, for the admin player view. */
export interface PlayerSession {
  status: string;
  lastPlayed: string | null;
  details: string;
}

export interface ServerGame {
  /** The folder name, the same as the frontend folder (`word-ladder`). */
  id: string;
  label: string;
  /**
   * Where the game keeps its own files: every key starts with this prefix,
   * then the player's id (`word-ladder/` → `word-ladder/<userId>/...`).
   */
  storage?: string;
  /** Its high-score board earns podium points (3, 2, 1) on the leaderboard. */
  podium?: boolean;
  /** A weekly play with steps of its own: whether it can start, and if one is open. */
  status?: (userId: string) => Promise<SessionStatus>;
  /** Answers kept in the game's own files rather than the answer history. */
  olderAnswers?: (userId: string) => Promise<HistoryEntry[]>;
  /** For the admin views: open plays, one player's state, and a reset. */
  admin?: {
    open: () => Promise<OpenSession[]>;
    of: (userId: string) => Promise<PlayerSession>;
    /** Removes the player's open play and cooldown files; returns what it removed. */
    reset: (userId: string) => Promise<string[]>;
  };
  /** What the member summary's writer is told about how the player plays it. */
  aboutPlayer?: {
    /** A section for the prompt, or '' when there is nothing to say. */
    facts: (userId: string) => Promise<string>;
    /** One guideline line for both summaries. */
    guideline: string;
    /** One line for the regular summary's gameplay focus. */
    focus: string;
    /** One line for the roast's gameplay targets. */
    roast: string;
  };
}

const registered: ServerGame[] = [];

/** Called once per folder by the games slice. */
export function registerGame(game: ServerGame): void {
  if (registered.some((g) => g.id === game.id)) return;
  registered.push(game);
}

/** Every registered game, in folder order. */
export const serverGames = (): readonly ServerGame[] => registered;

export const serverGame = (id: string): ServerGame | undefined =>
  registered.find((g) => g.id === id);

/** The games whose high-score boards earn podium points. */
export const podiumGames = (): string[] => registered.filter((g) => g.podium).map((g) => g.id);

/** Answers the games keep in their own files, to read with the answer history. */
export async function olderAnswersOf(userId: string): Promise<HistoryEntry[]> {
  const all = await Promise.all(
    registered.map((g) => g.olderAnswers?.(userId).catch(() => []) ?? []),
  );
  return all.flat();
}

/**
 * Each session game's status, keyed by camelId (`wordLadder`), the shape
 * app-init has always sent (`gameStatuses`).
 */
export async function sessionStatusesOf(
  userId: string,
): Promise<
  Record<string, { canPlay: boolean; hasActiveSession: boolean; nextAvailable: string | null }>
> {
  const all = await Promise.all(
    registered.flatMap((g) =>
      g.status
        ? [
            g
              .status(userId)
              .catch((): SessionStatus => ({ canPlay: true, nextAvailable: null, active: false }))
              .then((s) => [
                camelId(g.id),
                {
                  canPlay: s.canPlay,
                  hasActiveSession: s.active,
                  nextAvailable: s.nextAvailable?.toISOString() ?? null,
                },
              ]),
          ]
        : [],
    ),
  );
  return Object.fromEntries(all);
}

/** A game id as a JSON key: `word-ladder` → `wordLadder` (app-init, the archive). */
export const camelId = (id: string): string =>
  id.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
