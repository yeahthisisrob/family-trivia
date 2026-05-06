// File: lambda/routes/casino.ts
// Shared credit pool for casino games (slots + blackjack + future).
//
// Balance starts at the user's trivia season score (the "floor").
// Casino winnings push balance above the floor. Losses can't drop it
// below the floor — you always have your trivia points to play with.
// The balance IS the leaderboard score for the "casino" arcade game.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { getHighScores, submitScore } from '../services/arcadeService';
import { logger } from '../services/logger';
import { getPlayerState, getSeasonSummary } from '../services/playerStateService';
import { computePoints, HistoryEntry } from '../services/scoring';
import { getJson, putJson } from '../services/s3';

interface CasinoBalance {
  balance: number;
  lastUpdated: string;
}

async function getTriviaSeasionScore(userId: string): Promise<number> {
  const [playerState, seasonSummary] = await Promise.all([
    getPlayerState(userId),
    getSeasonSummary(),
  ]);

  let score = 0;
  const seasonStart = seasonSummary.activeSeason?.startDate;
  const seasonEnd = seasonSummary.activeSeason?.endDate;

  if (playerState?.history && seasonStart) {
    for (const h of playerState.history) {
      const d = h.timestamp?.split('T')[0];
      if (!d || d < seasonStart) continue;
      if (seasonEnd && d > seasonEnd) continue;
      if ((h as HistoryEntry).correct) score += computePoints(h as HistoryEntry);
    }
  } else {
    score = playerState?.score ?? 0;
  }

  // Include feud + arcade bonus (same as consolidatedLeaderboard)
  try {
    const { getRecentRounds } = await import('../services/familyFeudService');
    const feudRounds = await getRecentRounds(100);
    for (const round of feudRounds) {
      if (round.results?.winners) {
        for (const winner of round.results.winners) {
          if (winner.userId === userId) {
            const roundDate = round.startedAt?.split('T')[0];
            if (seasonStart && roundDate && roundDate >= seasonStart && (!seasonEnd || roundDate <= seasonEnd)) {
              score += winner.points;
            }
          }
        }
      }
    }
  } catch { /* ok */ }

  try {
    const ARCADE_GAMES = ['tetris', 'curling', 'slot-machine'] as const;
    const PLACEMENT_BONUS = [3, 2, 1];
    const allScores = await Promise.all(ARCADE_GAMES.map(g => getHighScores(g)));
    for (const scores of allScores) {
      const awarded = new Set<string>();
      let rank = 0;
      for (const entry of scores) {
        if (awarded.has(entry.userId)) continue;
        if (rank >= 3) break;
        if (entry.userId === userId) score += PLACEMENT_BONUS[rank];
        awarded.add(entry.userId);
        rank++;
      }
    }
  } catch { /* ok */ }

  return score;
}

/**
 * GET /casino/balance?userId=X
 *
 * Returns { balance, floor }. Initializes from trivia score if no
 * stored balance. Floor always = current trivia score. If stored
 * balance < floor, it's raised to the floor (you earned more trivia
 * points since last visit).
 */
export async function getCasinoBalance(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const [stored, floor] = await Promise.all([
      getJson<CasinoBalance>(S3_PATHS.CASINO_BALANCE(userId)),
      getTriviaSeasionScore(userId),
    ]);

    const balance = Math.max(stored?.balance ?? 0, floor);

    // Persist if we raised to the new floor
    if (!stored || stored.balance < floor) {
      await putJson(S3_PATHS.CASINO_BALANCE(userId), {
        balance,
        lastUpdated: new Date().toISOString(),
      });
    }

    return successResponse({ balance, floor });
  } catch (error: any) {
    logger.error('Failed to get casino balance', { userId, error: error.message });
    return successResponse({ balance: 0, floor: 0 });
  }
}

/**
 * POST /casino/balance
 * Body: { userId, balance }
 *
 * Updates the shared pool. Enforces floor. Also submits to the
 * "casino" arcade leaderboard so the balance shows in high scores.
 */
export async function updateCasinoBalance(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, balance: newBalance } = body as { userId?: string; balance?: number };
  if (!userId || newBalance === undefined) return errorResponse('Missing userId or balance', 400);

  try {
    // Save the actual balance — no floor clamping. Losses are real.
    // The floor only applies on GET (next session start), so players
    // always come back with at least their trivia score.
    const rounded = Math.max(0, Math.round(newBalance));

    await putJson(S3_PATHS.CASINO_BALANCE(userId), {
      balance: rounded,
      lastUpdated: new Date().toISOString(),
    });

    // Submit to leaderboard only if it's a high score (fire-and-forget)
    try { await submitScore('casino', userId, rounded, 'arcade'); } catch { /* ok */ }

    logger.info('Casino balance updated', { userId, balance: rounded });
    return successResponse({ balance: rounded, floor: 0 });
  } catch (error: any) {
    logger.error('Failed to update casino balance', { userId, error: error.message });
    return errorResponse('Failed to update balance', 500);
  }
}
