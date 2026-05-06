// Module: arcade
// Arcade mode API — high score leaderboards + unlimited score submission.

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

import type { ArcadeGameId, HighScoreEntry, ScoreSubmitResult } from '@family-trivia/shared';

export type { ArcadeGameId, HighScoreEntry, ScoreSubmitResult } from '@family-trivia/shared';

const logger = createLogger('ArcadeAPI');

/**
 * Get the unified leaderboard for a game (includes trivia + arcade scores).
 */
export async function getArcadeLeaderboard(game: ArcadeGameId): Promise<HighScoreEntry[]> {
  try {
    const result = await apiService.request<{ game: string; scores: HighScoreEntry[] }>(
      `/arcade/leaderboard?game=${encodeURIComponent(game)}`,
      { method: 'GET' },
    );
    return result.scores ?? [];
  } catch (error) {
    logger.error('Failed to fetch arcade leaderboard', error);
    return [];
  }
}

/**
 * Submit an arcade mode score (no cooldown, no trivia question).
 */
export async function submitArcadeScore(
  userId: string,
  game: ArcadeGameId,
  score: number,
): Promise<ScoreSubmitResult> {
  const result = await apiService.request<ScoreSubmitResult>('/arcade/submit-score', {
    method: 'POST',
    body: JSON.stringify({ userId, game, score }),
  });
  return result;
}
