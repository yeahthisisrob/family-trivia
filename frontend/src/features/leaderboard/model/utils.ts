// File: src/features/leaderboard/model/utils.ts
import { formatDistanceToNow } from 'date-fns';
import type { PlayerResult } from '../../../entities/leaderboard';

// Import the utility for checking if a category is custom
import { isCustomCategory } from '../../../utils/categoryUtils';

/** Helper to get user initials */
export const getUserInitials = (userId: string): string => {
  const parts = userId.split(/[-_ ]/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : userId.slice(0, 2).toUpperCase();
};

/** One answer, as the results carry it (a player's last answer). */
type Answer = NonNullable<PlayerResult['lastAnswer']>;

/** Where a player's points come from. */
export type PointBreakdown = NonNullable<PlayerResult['pointBreakdown']>;

/**
 * Compute effective points for a history entry
 * Priority: pointsEarned > pointMultiplier > difficulty-based default
 */
export const computePoints = (h: Answer): number => {
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
export const calculateCategoryScores = (history: Answer[]): Record<string, number> => {
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
        map.Custom = (map.Custom || 0) + pts;
      } else {
        // Standard category - track normally
        map[category] = (map[category] || 0) + pts;
      }
    }
  });

  return map;
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
    mergedScores.Custom = customScore;
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
    mergedScores.Custom = customScore;
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

/**
 * Calculate average score for a group
 *
 * This includes players who have answered questions but got 0 points,
 * but excludes players who haven't answered any questions yet.
 */
export const calculateAdjustedGroupAverage = (groupPlayers: PlayerResult[]): number => {
  // Include players who have answered questions (those with lastAnswer)
  // This includes players with 0 points who have answered questions
  const activePlayers = groupPlayers.filter((p) => p.lastAnswer !== undefined);

  // Return 0 if there are no active players
  if (activePlayers.length === 0) return 0;

  // Calculate average based on active players
  const totalScore = activePlayers.reduce((sum, p) => sum + p.score, 0);
  return totalScore / activePlayers.length;
};
