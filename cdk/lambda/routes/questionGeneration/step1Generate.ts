// File: lambda/routes/questionGeneration/step1Generate.ts
// Purpose: Step 1 — Generate a trivia question via the multi-model pipeline.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../config';
import { logger } from '../../services/logger';
import { generateBestQuestion } from '../../services/questionPipeline';
import { checkPlayEligibility } from '../../services/playerStateService';
import { PlayMode } from '@family-trivia/shared';
import type { Step1Request, Step1Response } from '@family-trivia/shared';

export async function step1Generate(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}') as Step1Request;
    const {
      userId,
      mode,
      category,
      difficulty = 'normal',
      isCatchingUp = false,
      excludedTopics,
    } = body;

    if (!userId || !mode) {
      return errorResponse('Missing required parameters: userId and mode', 400);
    }
    if ((mode === 'category' || mode === 'custom') && !category) {
      return errorResponse(`Category must be provided when mode is "${mode}"`, 400);
    }

    // Eligibility gate — prevents unlimited generation
    const requestedMode: PlayMode = isCatchingUp ? 'catchup' : 'regular';
    const eligibility = await checkPlayEligibility(userId, requestedMode);
    if (!eligibility.canPlay) {
      const message =
        eligibility.reason === 'no_catchup_available'
          ? 'No catch-up questions available'
          : eligibility.reason === 'end_of_season'
            ? 'Season has ended'
            : 'Daily question limit reached';
      logger.warn(`Step1 blocked for ${userId}: ${message}`);
      return errorResponse(message, 403, JSON.stringify({
        reason: eligibility.reason,
        nextAvailableAt: eligibility.nextAvailableAt,
        catchupAvailable: eligibility.catchupAvailable,
      }));
    }

    const startTime = Date.now();
    logger.info('Step1: generating question', { userId, mode, category, difficulty });

    // Build extra prompt parts for topic exclusion on retry
    const extraPromptParts: string[] = [];
    if (excludedTopics?.length) {
      extraPromptParts.push(
        `IMPORTANT: Do NOT ask about any of these topics: ${excludedTopics.join(', ')}. Pick a completely different subject.`,
      );
    }

    const result = await generateBestQuestion({
      userId,
      mode: mode as string,
      category,
      difficulty,
      extraPromptParts,
    });

    const sessionId = `${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const response: Step1Response = {
      question: result.question,
      sessionId,
      generatedAt: Date.now(),
      source: result.source,
      bedrockCalls: result.bedrockCalls,
    };

    logger.info('Step1 complete', {
      userId,
      sessionId,
      duration: Date.now() - startTime,
      source: result.source,
    });

    return successResponse(response);
  } catch (error: any) {
    logger.error('Step1 error', { error: error.message, stack: error.stack });
    return errorResponse(error.message || 'Failed to generate question', 500);
  }
}
