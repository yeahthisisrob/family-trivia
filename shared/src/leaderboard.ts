import { DifficultyLevel } from './question';
import { HistoryEntry } from './history';

/** Breakdown of where a player's points come from */
export interface PointBreakdown {
  /** Points from daily trivia + catch-up questions */
  regularPoints: number;
  /** Points from game modes (Casino Rush, Slot Machine, Curling, Tetris multipliers) */
  gameModePoints: number;
  /** Bonus points for placing top 3 on arcade high score leaderboards */
  arcadeBonusPoints: number;
  /** Points from Family Feud correct guesses */
  familyFeudPoints: number;
}

/** Basic leaderboard entry */
export interface LeaderboardEntry {
  userId: string;
  score: number;
  streak: number;
  lastAnswer?: HistoryEntry;
  categoryScores?: Record<string, number>;
  difficultyStats?: {
    easy: number;
    normal: number;
    hard: number;
    total: number;
  };
  avgPointsPerQuestion?: number;
  accuracy?: number;
  questionsAnswered?: number;
  /** Breakdown of point sources */
  pointBreakdown?: PointBreakdown;
}

/** Aggregated group leaderboard entry */
export interface GroupLeaderboardEntry {
  groupId: string;
  totalScore: number;
  memberCount: number;
  topScorer: string;
  topScore: number;
  averageScore: number;
  categoryScores?: Record<string, number>;
  difficultyStats?: {
    easy: number;
    normal: number;
    hard: number;
    total: number;
    dominant?: DifficultyLevel;
  };
}

/** Season info for leaderboard filtering */
export interface SeasonInfo {
  seasonNumber: number;
  name: string;
  startDate: string;
  endDate: string | null;
  status: string;
}
