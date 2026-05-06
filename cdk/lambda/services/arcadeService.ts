// File: lambda/services/arcadeService.ts
// Purpose: Unified high score service for all game modes.
// Scores from both trivia plays and arcade plays go into the same leaderboard.

import { getJson, putJson } from './s3';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import type { HighScoreEntry, ScoreSubmitResult, ArcadeGameId, NotificationItem } from '@family-trivia/shared';

/**
 * Get all high scores for a game, sorted highest first.
 */
export async function getHighScores(gameId: ArcadeGameId): Promise<HighScoreEntry[]> {
  const scores = await getJson<HighScoreEntry[]>(S3_PATHS.ARCADE_SCORES(gameId));
  return (scores ?? []).sort((a, b) => b.score - a.score);
}

/**
 * Submit a score and update the leaderboard.
 * Keeps each user's personal best per mode (trivia and arcade tracked separately).
 * Returns whether it's a new high score, the rank, and the updated leaderboard.
 */
export async function submitScore(
  gameId: ArcadeGameId,
  userId: string,
  score: number,
  mode: 'trivia' | 'arcade',
): Promise<ScoreSubmitResult> {
  const scores = await getHighScores(gameId);

  // Find user's existing best for this mode
  const existingIdx = scores.findIndex(h => h.userId === userId && h.mode === mode);
  const previousBest = existingIdx >= 0 ? scores[existingIdx].score : 0;
  const isNewHighScore = score > previousBest;

  if (isNewHighScore) {
    const entry: HighScoreEntry = {
      userId,
      score,
      date: new Date().toISOString(),
      mode,
    };

    if (existingIdx >= 0) {
      scores[existingIdx] = entry;
    } else {
      scores.push(entry);
    }

    // Re-sort and persist
    scores.sort((a, b) => b.score - a.score);
    await putJson(S3_PATHS.ARCADE_SCORES(gameId), scores);

    logger.info('New high score recorded', { gameId, userId, score, mode, previousBest });
  }

  // Calculate rank (user's best score position across all modes)
  const userBest = scores
    .filter(h => h.userId === userId)
    .sort((a, b) => b.score - a.score)[0];
  const rank = userBest
    ? scores.filter(h => h.score > userBest.score).length + 1
    : scores.length + 1;

  // Write high score event for notifications (fire-and-forget)
  if (isNewHighScore) {
    writeHighScoreEvent(gameId, userId, score, previousBest, rank).catch(err =>
      logger.warn('Failed to write high score event', { error: err instanceof Error ? err.message : String(err) }),
    );
  }

  return {
    isNewHighScore,
    rank,
    previousBest,
    highScores: scores.slice(0, 20), // Top 20
  };
}

// ── High Score Notifications ──────────────────────────────────────

const HIGH_SCORE_EVENTS_KEY = 'notifications/events/high-scores.json';

/**
 * Write a high score event that the notification service picks up.
 * Stored as a shared array — keeps the last 20 events.
 */
async function writeHighScoreEvent(
  gameId: string,
  userId: string,
  score: number,
  previousBest: number,
  rank: number,
): Promise<void> {
  const events = (await getJson<NotificationItem[]>(HIGH_SCORE_EVENTS_KEY)) ?? [];

  events.unshift({
    id: `high-score-${gameId}-${userId}-${Date.now()}`,
    type: 'high_score',
    timestamp: new Date().toISOString(),
    read: false,
    gameId,
    scoreUserId: userId,
    score,
    previousBest,
    rank,
  });

  // Keep only last 20 events
  await putJson(HIGH_SCORE_EVENTS_KEY, events.slice(0, 20));
}
