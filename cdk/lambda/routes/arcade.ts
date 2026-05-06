// File: lambda/routes/arcade.ts
// Purpose: Arcade endpoints — leaderboards + unlimited score submission.
// No cooldowns, no trivia questions — just play and record scores.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getHighScores, submitScore } from '../services/arcadeService';
import type { ArcadeGameId } from '@family-trivia/shared';

const VALID_GAMES: ArcadeGameId[] = ['tetris', 'curling', 'slot-machine', 'crossword', 'snake', 'blackjack', 'casino'];

/**
 * GET /arcade/leaderboard?game=tetris|curling
 * Returns unified high scores (trivia + arcade plays) for a game.
 */
export async function arcadeLeaderboard(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const game = event.queryStringParameters?.game as ArcadeGameId | undefined;
  if (!game || !VALID_GAMES.includes(game)) {
    return errorResponse(`Invalid game — must be one of: ${VALID_GAMES.join(', ')}`, 400);
  }

  try {
    const scores = await getHighScores(game);
    return successResponse({ game, scores: scores.slice(0, 20) });
  } catch (err: any) {
    logger.error('Error fetching arcade leaderboard', { game, error: err.message });
    return errorResponse('Failed to fetch leaderboard', 500);
  }
}

/**
 * POST /arcade/submit-score
 * Body: { userId, game, score }
 * No cooldown, no trivia question — arcade mode only.
 */
export async function arcadeSubmitScore(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, game, score } = body as {
      userId: string;
      game: ArcadeGameId;
      score: number;
    };

    if (!userId) return errorResponse('Missing userId', 400);
    if (!game || !VALID_GAMES.includes(game)) {
      return errorResponse(`Invalid game — must be one of: ${VALID_GAMES.join(', ')}`, 400);
    }
    if (typeof score !== 'number' || score < 0) {
      return errorResponse('Invalid score', 400);
    }

    const result = await submitScore(game, userId, score, 'arcade');

    logger.info('Arcade score submitted', {
      userId, game, score,
      isNewHighScore: result.isNewHighScore,
      rank: result.rank,
    });

    return successResponse(result);
  } catch (err: any) {
    logger.error('Error submitting arcade score', { error: err.message });
    return errorResponse('Failed to submit score', 500);
  }
}
