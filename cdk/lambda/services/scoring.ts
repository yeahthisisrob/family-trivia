/**
 * Shared scoring types and logic used by leaderboard routes.
 */

import { HistoryEntry, LeaderboardEntry } from '@family-trivia/shared';

export { HistoryEntry, LeaderboardEntry };

/**
 * Compute points for a history entry (matching frontend logic)
 * Priority: pointsEarned > pointMultiplier > difficulty-based default
 */
export function computePoints(h: HistoryEntry): number {
  if (h.pointsEarned != null) {
    return h.pointsEarned;
  }
  if (h.question.pointMultiplier != null) {
    return h.question.pointMultiplier;
  }
  const diff = h.question.difficulty || 'normal';
  switch (diff) {
    case 'easy': return 0.5;
    case 'hard': return 2.0;
    default:    return 1.0;
  }
}
