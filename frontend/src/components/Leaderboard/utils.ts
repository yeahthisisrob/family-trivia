// File: frontend/src/components/Leaderboard/utils.ts
import { formatDistanceToNow } from 'date-fns';

// Import the utility for checking if a category is custom
import { isCustomCategory } from '../../utils/categoryUtils';

/** Helper to get user initials */
export const getUserInitials = (userId: string): string => {
  const parts = userId.split(/[-_ ]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : userId.slice(0, 2).toUpperCase();
};

/** Helper to get consistent color for a user */
export const getUserColor = (userId: string): string => {
  const colors = [
    '#1976d2',
    '#388e3c',
    '#d32f2f',
    '#7b1fa2',
    '#c2185b',
    '#0288d1',
    '#fbc02d',
    '#455a64',
  ];
  const hash = userId.split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

/** Represents a single question history entry */
export interface QuestionHistory {
  question: {
    question: string;
    choices?: string[];
    answer: string;
    category?: string;
    difficulty?: 'easy' | 'normal' | 'hard';
    pointMultiplier?: number;
  };
  selectedAnswer: string;
  correct: boolean;
  timestamp: string;
  pointsEarned?: number;
  isCustomCategory?: boolean;
}

/** Breakdown of where a player's points come from */
export interface PointBreakdown {
  regularPoints: number;
  gameModePoints: number;
  arcadeBonusPoints: number;
  familyFeudPoints: number;
}

/** Leaderboard entry for a single user */
export interface LeaderboardEntry {
  userId: string;
  score: number; // total weighted points
  streak: number;
  lastAnswer?: QuestionHistory;
  categoryScores?: Record<string, number>;
  difficultyStats?: {
    easy: number;
    normal: number;
    hard: number;
    total: number;
  };
  avgPointsPerQuestion?: number;
  accuracy?: number; // Percentage of correct answers (0-100)
  questionsAnswered?: number; // Total questions this user has answered
  pointBreakdown?: PointBreakdown;
}

/**
 * Compute effective points for a history entry
 * Priority: pointsEarned > pointMultiplier > difficulty-based default
 */
export const computePoints = (h: QuestionHistory): number => {
  // First check if pointsEarned is explicitly defined
  if (h.pointsEarned !== undefined && h.pointsEarned !== null) {
    return h.pointsEarned;
  }

  // Then check if the question has a pointMultiplier
  if (h.question.pointMultiplier !== undefined && h.question.pointMultiplier !== null) {
    return h.question.pointMultiplier;
  }

  // Finally fall back to difficulty-based default values
  switch (h.question.difficulty) {
    case 'easy':
      return 0.5;
    case 'hard':
      return 2.0;
    default:
      return 1.0; // Handles 'normal' and undefined difficulty
  }
};

/** Aggregate weighted category scores with custom category handling */
export const calculateCategoryScores = (history: QuestionHistory[]): Record<string, number> => {
  const map: Record<string, number> = {};

  history.forEach((h) => {
    if (h.correct && h.question.category) {
      const pts = computePoints(h);
      const category = h.question.category;

      // Check for custom category in two ways:
      // 1. Explicit flag from API or 2. Custom category name detection
      const isCustomCat = h.isCustomCategory === true || isCustomCategory(category);

      if (isCustomCat) {
        // All custom categories go to a single aggregate entry
        map['Custom'] = (map['Custom'] || 0) + pts;
      } else {
        // Standard category - track normally
        map[category] = (map[category] || 0) + pts;
      }
    }
  });

  return map;
};

/** Compute difficulty distribution */
export const calculateDifficultyStats = (
  history: QuestionHistory[],
): { easy: number; normal: number; hard: number; total: number } => {
  const stats = { easy: 0, normal: 0, hard: 0, total: history.length };
  history.forEach((h) => {
    const d = h.question.difficulty || 'normal';
    stats[d]++;
  });
  return stats;
};

/** Determine dominant difficulty */
export const determineDominantDifficulty = (stats: {
  easy: number;
  normal: number;
  hard: number;
}): 'easy' | 'normal' | 'hard' => {
  if (stats.easy >= stats.normal && stats.easy >= stats.hard) {
    return 'easy';
  }
  if (stats.normal >= stats.easy && stats.normal >= stats.hard) {
    return 'normal';
  }
  return 'hard';
};

/** Info for difficulty levels */
export const getDifficultyInfo = (
  difficulty?: 'easy' | 'normal' | 'hard',
): { label: string; emoji: string; multiplier: number; pointsLabel: string } => {
  switch (difficulty) {
    case 'easy':
      return { label: 'Easy', emoji: '🌱', multiplier: 0.5, pointsLabel: 'Half Points' };
    case 'hard':
      return { label: 'Hard', emoji: '🔥', multiplier: 2.0, pointsLabel: 'Double Points' };
    default:
      return { label: 'Normal', emoji: '🧠', multiplier: 1.0, pointsLabel: 'Standard Points' };
  }
};

/**
 * Pick top category by score with proper custom category handling
 *
 * This function aggregates all custom category scores before determining the top category,
 * ensuring that custom categories are properly represented in results.
 */
export const getTopCategory = (scores?: Record<string, number>): string | null => {
  if (!scores) return null;

  // First merge any custom categories into a single "Custom" entry
  const mergedScores: Record<string, number> = {};
  let customScore = 0;

  // Process each category
  Object.entries(scores).forEach(([name, value]) => {
    // Check if this is a custom category or already merged "Custom" entry
    const isCustom = name === 'Custom' || isCustomCategory(name);

    if (isCustom) {
      // Add to the custom category aggregate score
      customScore += value;
    } else {
      // Regular category - keep as is
      mergedScores[name] = value;
    }
  });

  // If we found any custom categories, add the aggregate entry
  if (customScore > 0) {
    mergedScores['Custom'] = customScore;
  }

  // Now find the top category from the merged scores
  const entries = Object.entries(mergedScores);
  if (!entries.length) return null;

  entries.sort(([, a], [, b]) => b - a);
  const topCategory = entries[0][0];

  return topCategory;
};

/**
 * Convert category scores map to array with handling for custom categories
 *
 * This ensures all custom category entries are properly merged into a single "Custom" entry
 * before being returned for display in the UI.
 */
export const getCategoryData = (
  scores?: Record<string, number>,
): { name: string; value: number }[] => {
  if (!scores) return [];

  // First, ensure all custom categories are merged into a single "Custom" entry
  const mergedScores: Record<string, number> = {};
  let customScore = 0;

  // Process each category
  Object.entries(scores).forEach(([name, value]) => {
    // Check if this is a custom category or already merged "Custom" entry
    const isCustom = name === 'Custom' || isCustomCategory(name);

    if (isCustom) {
      // Add to the custom category aggregate score
      customScore += value;
    } else {
      // Regular category - keep as is
      mergedScores[name] = value;
    }
  });

  // If we found any custom categories, add the aggregate entry
  if (customScore > 0) {
    mergedScores['Custom'] = customScore;
  }

  // Convert to array
  const result = Object.entries(mergedScores).map(([name, value]) => ({ name, value }));

  // Sort by value (highest first)
  const sortedResult = result.sort((a, b) => b.value - a.value);

  return sortedResult;
};

/** Compute percentage for progress */
export const calculatePercentage = (value: number, total: number): number =>
  total > 0 ? (value / total) * 100 : 0;

/** Format timestamp like '5 minutes ago' */
export const formatTimestamp = (ts: string): string => {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true });
  } catch {
    return 'recently';
  }
};

/** Group description type */
export interface GroupDescription {
  description: string;
  lastUpdated: string;
  updatedBy?: string;
}

/** Aggregated group leaderboard entry */
export interface GroupScore {
  groupId: string;
  totalScore: number;
  memberCount: number;
  activeMemberCount?: number; // Number of members who played in last 14 days
  topScorer: string;
  topScore: number;
  averageScore: number;
  categoryScores?: Record<string, number>;
  difficultyStats?: {
    easy: number;
    normal: number;
    hard: number;
    total: number;
    dominant?: 'easy' | 'normal' | 'hard';
  };
  accuracy?: number; // Group accuracy percentage (0-100)
  description?: GroupDescription; // Include group description from consolidated API
}

/**
 * Calculate average score for a group
 *
 * This includes players who have answered questions but got 0 points,
 * but excludes players who haven't answered any questions yet.
 */
export const calculateAdjustedGroupAverage = (groupPlayers: LeaderboardEntry[]): number => {
  // Include players who have answered questions (those with lastAnswer)
  // This includes players with 0 points who have answered questions
  const activePlayers = groupPlayers.filter((p) => p.lastAnswer !== undefined);

  // Return 0 if there are no active players
  if (activePlayers.length === 0) return 0;

  // Calculate average based on active players
  const totalScore = activePlayers.reduce((sum, p) => sum + p.score, 0);
  return totalScore / activePlayers.length;
};
