import { HistoryEntry } from './history';

/** A single fact item from a user's profile */
export interface FactItem {
  id: string;
  date: string;
  question: string;
  answer: string;
  fact: string;
  timestamp: string;
  skipped?: boolean;
}

/** A record of category selections over time */
export interface CategorySelection {
  category: string;
  timestamp: string;
  isCustom?: boolean;
}

/** Breakdown of how many questions of each difficulty the user has answered */
export interface DifficultyStats {
  easy: number;
  normal: number;
  hard: number;
  total: number;
}

/** Detailed scoring history entry */
export interface ScoreHistoryEntry {
  date: string;
  gameType: string;
  category: string;
  difficulty: string;
  pointsAttempted: number;
  pointsEarned: number;
  correct: boolean;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCasinoRush: boolean;
  questionNumber?: number;
  totalQuestions?: number;
}

/** Stats about bonus points earned from tough categories */
export interface CategoryBonusStats {
  timesBonusEarned: number;
  totalBonusPoints: number;
}

/** The complete shape returned by the user-profile endpoint */
export interface UserProfile {
  profile: Record<string, unknown>;
  history: HistoryEntry[];
  streak: number;
  facts: FactItem[];
  categorySelections: CategorySelection[];
  difficultyStats: DifficultyStats;
  categoryBonusStats?: CategoryBonusStats;
  totalScore: number;
  scoringHistory?: ScoreHistoryEntry[];
  lastUpdated: string;
}
