import { Question } from './question';

/**
 * A single answered question record.
 * This is the canonical definition used by both frontend and backend.
 */
export interface HistoryEntry {
  question: Question;
  selectedAnswer: string;
  correct: boolean;
  timestamp: string;
  pointsEarned?: number;
  streak?: number;
  isCatchingUp?: boolean;
  isCasinoRush?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  reason?: string;
  isCustomCategory?: boolean;
  /** Groups casino rush questions belonging to the same session */
  casinoSessionId?: string;
  /** Marks entries from the Slot Machine game mode */
  isSlotMachine?: boolean;
  /** Marks entries from the Curling game mode */
  isCurling?: boolean;
  /** The multiplier earned from Curling (0.5, 1, 2, or 3) */
  curlingMultiplier?: number;
  /** Marks entries from the Tetris game mode */
  isTetris?: boolean;
  /** The multiplier earned from Tetris (1, 2, or 3) */
  tetrisMultiplier?: number;
  /** Bonus points earned for picking a tough category (low global accuracy) */
  categoryBonus?: number;
}
