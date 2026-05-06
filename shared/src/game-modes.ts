/**
 * Game Mode Registry — single source of truth for all special game modes.
 *
 * Adding a new game mode:
 *   1. Add its id to GameModeId
 *   2. Add the isFoo flag to HistoryEntry (history.ts)
 *   3. Add an entry to GAME_MODES below
 *   4. Build the route handler + UI component
 *
 * Backend and frontend both import from here so iterating over game modes
 * (eligibility checks, UI buttons, grid cell styling, etc.) stays DRY.
 */

import type { HistoryEntry } from './history';

export type GameModeId = 'casino-rush' | 'slot-machine' | 'curling' | 'tetris';

export interface GameModeConfig {
  id: GameModeId;
  /** Display label in the UI */
  label: string;
  /** Short description for the button subtitle */
  description: string;
  /** Material icon name (for the frontend) */
  iconName: 'Casino' | 'SmartToy' | 'AcUnit' | 'Gamepad';
  /** Tailwind/MUI accent color group */
  accent: 'error' | 'secondary' | 'info';
  /** Cooldown in milliseconds between plays */
  cooldownMs: number;
  /** Which HistoryEntry boolean flag marks entries from this mode */
  historyFlag: 'isCasinoRush' | 'isSlotMachine' | 'isCurling' | 'isTetris';
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const GAME_MODES: GameModeConfig[] = [
  {
    id: 'casino-rush',
    label: 'Casino Rush',
    description: '3 questions, 60s each — triple or bust',
    iconName: 'Casino',
    accent: 'error',
    cooldownMs: WEEK_MS,
    historyFlag: 'isCasinoRush',
  },
  {
    id: 'slot-machine',
    label: 'Slot Machine',
    description: 'Spin for a random category + multiplier',
    iconName: 'SmartToy',
    accent: 'secondary',
    cooldownMs: WEEK_MS,
    historyFlag: 'isSlotMachine',
  },
  {
    id: 'curling',
    label: 'Curling',
    description: 'Hold and release — land on the button',
    iconName: 'AcUnit',
    accent: 'info',
    cooldownMs: WEEK_MS,
    historyFlag: 'isCurling',
  },
  {
    id: 'tetris',
    label: 'Tetris',
    description: '60s to clear lines — score your multiplier',
    iconName: 'Gamepad',
    accent: 'secondary',
    cooldownMs: WEEK_MS,
    historyFlag: 'isTetris',
  },
];

/** Lookup a config by id */
export function getGameMode(id: GameModeId): GameModeConfig | undefined {
  return GAME_MODES.find(m => m.id === id);
}

/** True if a history entry came from any game mode */
export function isGameModeEntry(h: HistoryEntry): boolean {
  return GAME_MODES.some(m => !!(h as any)[m.historyFlag]);
}

/** Get the game mode config that matches this history entry, if any */
export function gameModeOfEntry(h: HistoryEntry): GameModeConfig | undefined {
  return GAME_MODES.find(m => !!(h as any)[m.historyFlag]);
}
