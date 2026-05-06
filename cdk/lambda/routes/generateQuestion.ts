// File: lambda/routes/generateQuestion.ts
// Purpose: Generate a trivia question on-demand using Bedrock.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GenerateMode, DifficultyLevel } from '../services/bedrock';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { checkPlayEligibility } from '../services/playerStateService';
import { PlayMode } from '@family-trivia/shared';
import {
  generateQuestionWithOptions,
  GenerateQuestionRequest
} from './questionGeneration/shared';

export async function generateQuestion(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = body.userId as string;
  const mode = body.mode as GenerateMode;
  const customPrompt = body.customPrompt as string | undefined;
  const category = body.category as string | undefined;
  const difficulty = body.difficulty as DifficultyLevel | undefined;
  const isCatchingUp = body.isCatchingUp as boolean | undefined;
  const withProgress = body.withProgress as boolean | undefined;

  logger.info('Generate question request', {
    userId,
    mode,
    customPrompt: customPrompt ? 'provided' : 'not provided',
    category,
    difficulty,
    isCatchingUp,
    withProgress,
  });

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }
  if (!mode) {
    return errorResponse('Missing mode', 400);
  }
  if ((mode === 'category' || mode === 'custom') && !category) {
    return errorResponse(`Missing category for ${mode} mode`, 400);
  }
  if (difficulty && !['easy', 'normal', 'hard'].includes(difficulty)) {
    return errorResponse('Invalid difficulty level. Must be "easy", "normal", or "hard"', 400);
  }

  // Server-side eligibility check — don't trust client's isCatchingUp flag
  const requestedMode: PlayMode = isCatchingUp ? 'catchup' : 'regular';
  const eligibility = await checkPlayEligibility(userId, requestedMode);

  if (!eligibility.canPlay) {
    const message = eligibility.reason === 'end_of_season'
      ? 'Season has ended'
      : eligibility.reason === 'no_catchup_available'
        ? 'No catch-up questions available'
        : 'Daily question limit reached';

    logger.warn(`User ${userId} blocked: ${message}`, {
      reason: eligibility.reason,
      catchupAvailable: eligibility.catchupAvailable,
    });

    return errorResponse(message, 403, JSON.stringify({
      reason: eligibility.reason,
      nextAvailableAt: eligibility.nextAvailableAt,
      catchupAvailable: eligibility.catchupAvailable,
    }));
  }

  // If client claimed catchup but server says no catchup available, treat as regular
  const validatedCatchingUp = requestedMode === 'catchup' && eligibility.catchupAvailable > 0;

  try {
    const request: GenerateQuestionRequest = {
      userId,
      mode,
      category,
      difficulty,
      customPrompt,
      withProgress,
      skipDailyCheck: validatedCatchingUp
    };

    const result = await generateQuestionWithOptions(request);

    if (withProgress && result.messages) {
      return successResponse({
        question: result.question,
        messages: result.messages,
        factCheckResult: result.factCheckResult,
        retriesNeeded: result.retriesNeeded
      });
    } else {
      return successResponse(result.question);
    }
  } catch (err: any) {
    logger.error('Question generation error', {
      userId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      errorType: err.name
    });
    return errorResponse('Failed to generate question', 500, err.message, err.name);
  }
}
