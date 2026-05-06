// File: lambda/routes/endOfSeasonStatus.ts
// Purpose: Get season status from S3-backed config

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getSeasonStatusResponse } from '../services/seasonService';

export async function endOfSeasonStatus(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const status = await getSeasonStatusResponse();

    logger.info('Season status check', {
      isEndOfSeason: status.isEndOfSeason,
      isBetweenSeasons: status.isBetweenSeasons,
      currentSeason: status.currentSeason?.seasonNumber ?? null,
      lastSeason: status.lastSeason?.seasonNumber ?? null,
    });

    return successResponse(status);
  } catch (err) {
    logger.error('Error checking season status', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return errorResponse('Failed to check season status', 500, err instanceof Error ? err.message : String(err));
  }
}
