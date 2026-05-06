// File: lambda/routes/canAnswerQuestion.ts
// Purpose: Check if a user is eligible to answer a question today

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { checkPlayEligibility } from '../services/playerStateService';

export async function canAnswerQuestion(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    const eligibility = await checkPlayEligibility(userId, 'regular');

    // Map to existing response shape for backward compatibility
    return successResponse({
      canAnswer: eligibility.canPlay,
      nextQuestionAt: eligibility.nextAvailableAt || new Date().toISOString(),
      todayET: eligibility.todayET,
      lastQuestionAt: eligibility.lastAnsweredAt,
      isEndOfSeason: eligibility.reason === 'end_of_season',
      catchupAvailable: eligibility.catchupAvailable,
    });
  } catch (err) {
    logger.error('Error checking if user can answer', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail open for read-only status check
    return successResponse({
      canAnswer: true,
      nextQuestionAt: new Date().toISOString(),
      todayET: '',
      lastQuestionAt: null,
    });
  }
}
