/**
 * Game modes: the ways a trivia question can be played for more than its
 * usual points (docs/decisions/0032).
 *
 * Every game that can be played for trivia points is a folder: its round
 * (`round` in frontend/src/games/<id>) and, when it has steps of its own
 * (Casino Rush's three questions, the Slot Machine's spin), its server
 * folder in backend/features/games/<id>. Nothing here lists them. Every
 * game plays once a week (ROUND_RULES.cooldownMs); a plain round also
 * follows the rest of ROUND_RULES.
 *
 * History entries name their mode in `gameMode`. Entries written before
 * that carry a flag per mode (`isCurling`, `isTetris`...), read by
 * gameModeOf so nothing stored has to change.
 */

import type { HistoryEntry } from './history';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** How every round is played and scored. */
export const ROUND_RULES = {
  /** The multipliers a game may award. */
  multipliers: [0.5, 1, 2, 3] as readonly number[],
  /** Points for a right answer: the multiplier, plus this for a new best score in the game. */
  newBestBonus: 1,
  /** One play per game per week. */
  cooldownMs: WEEK_MS,
} as const;

// Stored entries from before `gameMode`: one flag per mode. These are the
// field names in people's answer history, so they stay as they are.
const LEGACY_FLAGS: [keyof HistoryEntry, string][] = [
  ['isCasinoRush', 'casino-rush'],
  ['isSlotMachine', 'slot-machine'],
  ['isCurling', 'curling'],
  ['isTetris', 'tetris'],
];

/** The mode or round a history entry came from, if any. */
export function gameModeOf(h: HistoryEntry): string | undefined {
  return h.gameMode ?? LEGACY_FLAGS.find(([flag]) => !!h[flag])?.[1];
}

/** The stored per-mode flags an entry carries, for answers that pass them on as they were. */
export function legacyFlagsOf(h: HistoryEntry): Partial<HistoryEntry> {
  return Object.fromEntries(LEGACY_FLAGS.filter(([flag]) => !!h[flag]).map(([f]) => [f, true]));
}

/** True if a history entry came from any game mode or round */
export function isGameModeEntry(h: HistoryEntry): boolean {
  return gameModeOf(h) !== undefined;
}

/**
 * The play an answer belongs to, when one play asks several questions.
 * Stored as `casinoSessionId`, the field's name in people's history. The
 * answers of one play count as one question.
 */
export const playOf = (h: HistoryEntry): string | undefined => h.casinoSessionId;
