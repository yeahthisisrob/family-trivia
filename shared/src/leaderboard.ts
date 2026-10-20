import type { HistoryEntry } from './history';
import type { DifficultyLevel } from './question';

/** Breakdown of where a player's points come from */
export interface PointBreakdown {
  /** Points from daily trivia + catch-up questions */
  regularPoints: number;
  /** Points from game modes and rounds (the games' multipliers) */
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
  /** Trivia waiting for them this season (docs/decisions/0016), shown next to their name. */
  stillToPlay?: number;
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
