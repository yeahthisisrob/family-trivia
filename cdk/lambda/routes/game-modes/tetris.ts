// Tetris game mode — play 60 seconds of Tetris, score determines multiplier,
// then answer a trivia question. High score leaderboard with bonus point for records.
// Points earned = correct ? multiplier + (newHighScore ? 1 : 0) : 0.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../config';
import { HistoryEntry } from '@family-trivia/shared';
import { logger } from '../../services/logger';
import { getJson, putJson, deleteObject } from '../../services/s3';
import { S3_PATHS } from '../../constants';
import { canPlayGameMode, canPlayGameModeAny } from '../../services/gameModeService';
import { submitScore } from '../../services/arcadeService';
import { generateQuestionWithOptions } from '../questionGeneration/shared';
import { getAvailableCategories } from './shared';

const VALID_MULTIPLIERS = [1, 2, 3] as const;

interface TetrisSession {
  score: number;
  multiplier: number;
  category: string;
  question: {
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: string;
  };
  isNewHighScore: boolean;
  isCatchingUp: boolean;
  startedAt: number;
}

/**
 * GET /tetris/status — cooldown + eligibility
 */
export async function tetrisStatus(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  const status = await canPlayGameModeAny(userId, 'tetris');
  return successResponse({
    canPlay: status.canPlay,
    nextAvailable: status.nextAvailable?.toISOString() ?? null,
  });
}

/**
 * POST /tetris/lock — body: { userId, score, multiplier, isCatchingUp? }
 * After 60s of Tetris, lock the score + multiplier, check high scores,
 * generate a trivia question.
 */
export async function tetrisLock(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, score, multiplier, isCatchingUp = false } = body as {
    userId: string;
    score: number;
    multiplier: number;
    isCatchingUp?: boolean;
  };

  if (!userId) return errorResponse('Missing userId', 400);
  if (typeof score !== 'number' || score < 0) return errorResponse('Invalid score', 400);
  if (!VALID_MULTIPLIERS.includes(multiplier as typeof VALID_MULTIPLIERS[number])) {
    return errorResponse('Invalid multiplier — must be 1, 2, or 3', 400);
  }

  // Cooldown + eligibility
  const { canPlay, nextAvailable, blockedReason } =
    await canPlayGameMode(userId, 'tetris', isCatchingUp ? 'catchup' : 'tetris');
  if (!canPlay) {
    const msg =
      blockedReason === 'end_of_season' ? 'Season has ended' :
      blockedReason === 'no_catchup_available' ? 'No catch-up available' :
      blockedReason === 'daily_limit_reached' ? 'Daily question limit reached' :
      'Tetris is on cooldown';
    logger.warn(`Tetris blocked for ${userId}: ${blockedReason}`);
    return errorResponse(msg, 403, nextAvailable?.toISOString(), blockedReason || 'COOLDOWN');
  }

  // Record score in unified arcade leaderboard (trivia mode)
  const scoreResult = await submitScore('tetris', userId, score, 'trivia');
  const { isNewHighScore } = scoreResult;

  // Pick random category + generate question
  const categories = await getAvailableCategories(userId);
  if (!categories.length) return errorResponse('No categories available', 500);
  const category = categories[Math.floor(Math.random() * categories.length)];

  let questionData;
  try {
    const result = await generateQuestionWithOptions({
      userId,
      mode: 'category',
      category,
      difficulty: 'normal',
      withProgress: false,
    });
    questionData = result.question;
  } catch (err) {
    logger.error('Tetris question generation failed', {
      userId, category, error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to generate question', 500);
  }

  // Save session
  const session: TetrisSession = {
    score,
    multiplier,
    category,
    question: {
      question: questionData.question,
      choices: questionData.choices,
      answer: questionData.answer,
      category: questionData.category || category,
      difficulty: questionData.difficulty || 'normal',
    },
    isNewHighScore,
    isCatchingUp,
    startedAt: Date.now(),
  };
  await putJson(S3_PATHS.TETRIS_SESSION(userId), session);

  return successResponse({
    multiplier,
    question: {
      question: session.question.question,
      choices: session.question.choices,
      category: session.question.category,
    },
    isNewHighScore,
    highScores: scoreResult.highScores.slice(0, 10),
  });
}

/**
 * POST /tetris/answer — body: { userId, answer }
 * Score the trivia answer with the Tetris multiplier + optional high score bonus.
 */
export async function tetrisAnswer(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, answer } = body as { userId: string; answer: string };

  if (!userId) return errorResponse('Missing userId', 400);

  const session = await getJson<TetrisSession>(S3_PATHS.TETRIS_SESSION(userId));
  if (!session) return errorResponse('No active Tetris session', 400);

  const correct = (answer || '').trim().toLowerCase()
    === session.question.answer.trim().toLowerCase();
  const highScoreBonus = session.isNewHighScore ? 1 : 0;
  const pointsEarned = correct ? session.multiplier + highScoreBonus : 0;
  const timestamp = new Date().toISOString();

  // Write history
  const historyKey = S3_PATHS.ANSWER_HISTORY(userId);
  const history = (await getJson<HistoryEntry[]>(historyKey)) || [];

  const entry: HistoryEntry = {
    question: {
      question: session.question.question,
      choices: session.question.choices,
      answer: session.question.answer,
      category: session.question.category,
      difficulty: session.question.difficulty as 'easy' | 'normal' | 'hard',
      pointMultiplier: session.multiplier,
    },
    selectedAnswer: answer || '',
    correct,
    timestamp,
    pointsEarned,
    isTetris: true,
    tetrisMultiplier: session.multiplier,
    ...(session.isCatchingUp && { isCatchingUp: true }),
  };

  history.push(entry);
  await putJson(historyKey, history);

  // Clean up session
  try { await deleteObject(S3_PATHS.TETRIS_SESSION(userId)); }
  catch (err) { logger.warn('Failed to delete tetris session', { userId, err }); }

  logger.info('Tetris answer recorded', {
    userId, score: session.score, multiplier: session.multiplier,
    correct, pointsEarned, isNewHighScore: session.isNewHighScore,
  });

  return successResponse({
    correct,
    correctAnswer: session.question.answer,
    pointsEarned,
    multiplier: session.multiplier,
    highScoreBonus,
  });
}
