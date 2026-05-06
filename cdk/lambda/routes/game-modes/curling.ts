// Curling game mode — throw the stone, lock the multiplier, then answer
// a trivia question. Points earned = multiplier × (correct ? 1 : 0).
// The throw is run client-side; the server records the multiplier, picks
// a random category, generates the question, then scores the answer.

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

const VALID_MULTIPLIERS = [0.5, 1, 2, 3] as const;

interface CurlingSession {
  multiplier: number;
  category: string;
  question: {
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: string;
  };
  isCatchingUp: boolean;
  startedAt: number;
}

const CURLING_SESSION_KEY = (userId: string) => `curling/${userId}/session.json`;

/**
 * GET /curling/status — cooldown + eligibility for this mode
 */
export async function curlingStatus(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  // Combines weekly cooldown + eligibility (regular OR catchup).
  const status = await canPlayGameModeAny(userId, 'curling');
  return successResponse({
    canPlay: status.canPlay,
    nextAvailable: status.nextAvailable?.toISOString() ?? null,
  });
}

/**
 * POST /curling/lock — body: { userId, multiplier, isCatchingUp? }
 * Validates eligibility + cooldown, then picks a random category, generates
 * a question, stores the session, and returns the question. The stone is
 * already thrown at this point — multiplier is committed.
 */
export async function curlingLock(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, multiplier, precisionScore, isCatchingUp = false } = body as {
    userId: string;
    multiplier: number;
    /** 0-100 score based on distance from center (for high score leaderboard) */
    precisionScore?: number;
    isCatchingUp?: boolean;
  };

  if (!userId) return errorResponse('Missing userId', 400);
  if (!VALID_MULTIPLIERS.includes(multiplier as typeof VALID_MULTIPLIERS[number])) {
    return errorResponse('Invalid multiplier — must be 0.5, 1, 2, or 3', 400);
  }

  // Weekly cooldown + eligibility for the given PlayMode.
  const { canPlay, nextAvailable, blockedReason } =
    await canPlayGameMode(userId, 'curling', isCatchingUp ? 'catchup' : 'curling');
  if (!canPlay) {
    const msg =
      blockedReason === 'end_of_season' ? 'Season has ended' :
      blockedReason === 'no_catchup_available' ? 'No catch-up available' :
      blockedReason === 'daily_limit_reached' ? 'Daily question limit reached' :
      'Curling is on cooldown';
    logger.warn(`Curling blocked for ${userId}: ${blockedReason}`);
    return errorResponse(msg, 403, nextAvailable?.toISOString(), blockedReason || 'COOLDOWN');
  }

  // Record precision score in unified leaderboard (trivia mode)
  if (typeof precisionScore === 'number' && precisionScore >= 0) {
    await submitScore('curling', userId, precisionScore, 'trivia');
  }

  // Pick a random category
  const categories = await getAvailableCategories(userId);
  if (!categories.length) return errorResponse('No categories available', 500);
  const category = categories[Math.floor(Math.random() * categories.length)];

  // Generate a question for that category
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
    logger.error('Curling question generation failed', {
      userId, category, error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to generate question', 500);
  }

  // Save session
  const session: CurlingSession = {
    multiplier,
    category,
    question: {
      question: questionData.question,
      choices: questionData.choices,
      answer: questionData.answer,
      category: questionData.category || category,
      difficulty: questionData.difficulty || 'normal',
    },
    isCatchingUp,
    startedAt: Date.now(),
  };
  await putJson(CURLING_SESSION_KEY(userId), session);

  return successResponse({
    multiplier,
    question: {
      question: session.question.question,
      choices: session.question.choices,
      category: session.question.category,
    },
  });
}

/**
 * POST /curling/answer — body: { userId, answer }
 * Reads the curling session, scores the answer, records history with the
 * multiplier, deletes the session. Points = correct ? multiplier : 0.
 */
export async function curlingAnswer(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, answer } = body as { userId: string; answer: string };

  if (!userId) return errorResponse('Missing userId', 400);

  const session = await getJson<CurlingSession>(CURLING_SESSION_KEY(userId));
  if (!session) return errorResponse('No active curling session', 400);

  const correct = (answer || '').trim().toLowerCase()
    === session.question.answer.trim().toLowerCase();
  const pointsEarned = correct ? session.multiplier : 0;
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
    isCurling: true,
    curlingMultiplier: session.multiplier,
    ...(session.isCatchingUp && { isCatchingUp: true }),
  };

  history.push(entry);
  await putJson(historyKey, history);

  // Clean up session
  try { await deleteObject(CURLING_SESSION_KEY(userId)); }
  catch (err) { logger.warn('Failed to delete curling session', { userId, err }); }

  logger.info('Curling answer recorded', {
    userId, multiplier: session.multiplier, correct, pointsEarned,
  });

  return successResponse({
    correct,
    correctAnswer: session.question.answer,
    pointsEarned,
    multiplier: session.multiplier,
  });
}
