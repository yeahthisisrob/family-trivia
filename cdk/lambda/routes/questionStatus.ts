// File: lambda/routes/questionStatus.ts
// Delegates to playerStateService — single source of truth for eligibility.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { checkPlayEligibility } from '../services/playerStateService';

export async function questionStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    const eligibility = await checkPlayEligibility(userId, 'regular');

    return successResponse({
      lastQuestionAt: eligibility.lastAnsweredAt,
      nextQuestionAt: eligibility.nextAvailableAt || (eligibility.canPlay ? new Date().toISOString() : null),
    });
  } catch (error: any) {
    logger.error('Error fetching question status', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse('Failed to fetch question status', 500, error.message);
  }
}
