/**
 * Game modes: the ways a trivia question can be played for more than its
 * usual points (docs/decisions/0032).
 *
 * - **Rounds.** Any game can be a weekly round: play it, it sets a
 *   multiplier, then answer one trivia question for that many points. A
 *   game opts in from its own folder (`round` in frontend/src/games/<id>);
 *   nothing here lists them. Every round follows ROUND_RULES.
 * - **Sessions.** Casino Rush and Slot Machine run several steps of their
 *   own, with their own routes, and are listed below.
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
  /** One round per game per week. */
  cooldownMs: WEEK_MS,
} as const;

export type GameModeId = 'casino-rush' | 'slot-machine';

export interface GameModeConfig {
  id: GameModeId;
  /** Display label in the UI */
  label: string;
  /** Short description for the button subtitle */
  description: string;
  /** Cooldown in milliseconds between plays */
  cooldownMs: number;
  /** Which HistoryEntry flag marks entries from this mode */
  historyFlag: 'isCasinoRush' | 'isSlotMachine';
}

/** The session modes. Rounds are not listed: they come from the game folders. */
export const GAME_MODES: GameModeConfig[] = [
  {
    id: 'casino-rush',
    label: 'Casino Rush',
    description: '3 questions, 60s each — triple or bust',
    cooldownMs: WEEK_MS,
    historyFlag: 'isCasinoRush',
  },
  {
    id: 'slot-machine',
    label: 'Slot Machine',
    description: 'Spin for a random category + multiplier',
    cooldownMs: WEEK_MS,
    historyFlag: 'isSlotMachine',
  },
];

/** Lookup a session mode by id */
export function getGameMode(id: string): GameModeConfig | undefined {
  return GAME_MODES.find((m) => m.id === id);
}

/** How long between plays of a mode or a round. */
export const cooldownOf = (id: string): number =>
  getGameMode(id)?.cooldownMs ?? ROUND_RULES.cooldownMs;

// Entries from before `gameMode`: one flag per mode.
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

/** True if a history entry came from any game mode or round */
export function isGameModeEntry(h: HistoryEntry): boolean {
  return gameModeOf(h) !== undefined;
}
