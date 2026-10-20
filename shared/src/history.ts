import type { Question } from './question';

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
  /** Marks entries from the Casino Rush game mode (the flag it has always written) */
  isCasinoRush?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  reason?: string;
  isCustomCategory?: boolean;
  /** Groups the answers of one play that asks several questions (read with playOf) */
  casinoSessionId?: string;
  /** Before gameMode: marks entries from the Slot Machine game mode */
  isSlotMachine?: boolean;
  /** The game mode or round this came from (docs/decisions/0032). */
  gameMode?: string;
  /** The multiplier the game awarded, for rounds. */
  multiplier?: number;
  /** Before gameMode: marks entries from the Curling game mode */
  isCurling?: boolean;
  /** The multiplier earned from Curling (0.5, 1, 2, or 3) */
  curlingMultiplier?: number;
  /** Before gameMode: marks entries from the Tetris game mode */
  isTetris?: boolean;
  /** The multiplier earned from Tetris (1, 2, or 3) */
  tetrisMultiplier?: number;
  /** Bonus points earned for picking a tough category (low global accuracy) */
  categoryBonus?: number;
}
