/**
 * The game kit (docs/decisions/0032): everything a game needs from the app,
 * in one import. A game is a folder in src/games with an index.tsx that
 * default-exports defineGame({...}); the Arcade finds it on its own.
 */
import type { GameClue, HighScoreEntry, ScoreSubmitResult } from '@family-trivia/shared';
import type { SvgIconComponent } from '@mui/icons-material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { apiService } from '../../shared/api/ApiService';

export { gameLook } from '../../shared/design-system';

/** What the Arcade hands every game. */
export interface GameProps {
  userId: string;
  /** Back to the Arcade (the scores refresh). */
  onClose: () => void;
}

/** What the Trivia tab hands a game played as this week's round. */
export interface RoundProps {
  userId: string;
  /** Played as a catch-up question. */
  catchUp: boolean;
  onClose: () => void;
  /** After the answer, with the points it earned. */
  onComplete: (pointsEarned: number) => void;
}

export interface Game {
  /** The folder name: lowercase words joined by dashes ("word-ladder"). */
  id: string;
  label: string;
  /** One line on the tile. */
  description: string;
  /** A few words in capitals on the tile ("60s BLOCKS"). */
  badge: string;
  icon: SvgIconComponent;
  /**
   * The tile's gradient and accent: a token set, or gameLook(hue). `frame`
   * is the color around the game when it's played as a round.
   */
  look: { gradient: string; accent: string; frame?: string };
  /** The game itself; lazy(() => import('./MyGame')) keeps the Arcade fast. */
  Play: React.ComponentType<GameProps>;
  /** Lower comes first; games without one follow, by label. */
  order?: number;
  /** Show a high-score board under the tile (default true). */
  scores?: boolean;
  /**
   * Also playable as a weekly trivia round: the game sets a multiplier, then
   * one question (ROUND_RULES in shared/src/game-modes.ts). The game calls
   * lockRound when it's over and answerRound with the player's choice.
   */
  round?: {
    /** One line on the Trivia tab's tile ("Hold and release — land on the button"). */
    description: string;
    Round: React.ComponentType<RoundProps>;
  };
}

export const defineGame = (game: Game): Game => game;

// ── Scores ────────────────────────────────────────────────────────

/** The top 20 for a game, best first. */
export async function getScores(game: string): Promise<HighScoreEntry[]> {
  const r = await apiService.request<{ game: string; scores: HighScoreEntry[] }>(
    `/games/scores?game=${encodeURIComponent(game)}`,
    { method: 'GET' },
  );
  return r.scores ?? [];
}

/** Submit the player's score; their best counts. */
export function submitScore(game: string, score: number): Promise<ScoreSubmitResult> {
  return apiService.request<ScoreSubmitResult>('/games/scores', {
    method: 'POST',
    body: JSON.stringify({ game, score }),
  });
}

// ── Clues from the circle ─────────────────────────────────────────

/** Clues with one-word answers, from the circle's trivia and what people answered. */
export async function getClues(
  opts: { count?: number; minLength?: number; maxLength?: number } = {},
): Promise<GameClue[]> {
  const q = new URLSearchParams(
    Object.entries(opts).map(([k, v]) => [k, String(v)] as [string, string]),
  );
  const r = await apiService.request<{ clues: GameClue[] }>(`/games/clues?${q}`, {
    method: 'GET',
  });
  return r.clues ?? [];
}

// ── A save per player ─────────────────────────────────────────────

/**
 * The player's save for this game (progress, settings; up to 16,000
 * characters of JSON), kept on every device: `const [save, setSave] = useGameSave('snake', {level: 1})`.
 */
export function useGameSave<T>(game: string, initial: T): [T, (next: T) => void, boolean] {
  const [save, setLocal] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    apiService
      .request<{ save: T | null }>(`/games/save?game=${encodeURIComponent(game)}`, {
        method: 'GET',
      })
      .then((r) => r.save !== null && r.save !== undefined && setLocal(r.save))
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [game]);
  const set = useCallback(
    (next: T) => {
      setLocal(next);
      apiService
        .request('/games/save', { method: 'PUT', body: JSON.stringify({ game, save: next }) })
        .catch(() => undefined);
    },
    [game],
  );
  return [save, set, loaded];
}

// ── Rounds ────────────────────────────────────────────────────────

export interface RoundQuestion {
  question: string;
  choices: string[];
  category: string;
}

export interface RoundStatus {
  canPlay: boolean;
  nextAvailable: string | null;
}

/** For each game: can it be this week's round now, and if not, when. */
export async function getRoundStatus(games: string[]): Promise<Record<string, RoundStatus>> {
  if (!games.length) return {};
  const r = await apiService.request<{ rounds: Record<string, RoundStatus> }>(
    `/games/rounds?games=${encodeURIComponent(games.join(','))}`,
    { method: 'GET' },
  );
  return r.rounds ?? {};
}

/**
 * The game is over: keep its multiplier (0.5, 1, 2 or 3) and, if it has one,
 * its score, and get the question. A new best score adds a point.
 */
export function lockRound(
  game: string,
  round: { multiplier: number; score?: number; catchUp: boolean },
): Promise<{ multiplier: number; question: RoundQuestion; newBest: boolean }> {
  return apiService.request('/games/rounds/lock', {
    method: 'POST',
    body: JSON.stringify({ game, ...round }),
  });
}

/** Answer the round's question; pointsEarned includes the new-best point. */
export function answerRound(
  game: string,
  answer: string,
): Promise<{
  correct: boolean;
  correctAnswer: string;
  pointsEarned: number;
  multiplier: number;
  newBestBonus: number;
}> {
  return apiService.request('/games/rounds/answer', {
    method: 'POST',
    body: JSON.stringify({ game, answer }),
  });
}
