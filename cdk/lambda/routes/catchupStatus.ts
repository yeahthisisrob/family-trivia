// File: lambda/routes/catchupStatus.ts
// Purpose: Standalone catchup status endpoint.
// Core logic lives in playerStateService.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { calculateCatchupStatus } from '../services/playerStateService';

/**
 * Get a user's catchup status by comparing their answer count
 * with the user who has answered the most questions in the current season.
 */
export async function getCatchupStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Getting catchup status');

  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    logger.error('Missing userId parameter');
    return errorResponse('Missing userId parameter', 400);
  }

  try {
    const status = await calculateCatchupStatus(userId);
    return successResponse(status);
  } catch (err: any) {
    logger.error('Error calculating catchup status', {
      userId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return errorResponse('Failed to calculate catchup status', 500, err.message);
  }
}
