// File: lambda/routes/answerGrid.ts
// Purpose: Return pre-computed answer grid for the TriviaStatusBar matrix.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { buildAnswerGrid } from '../services/answerGridService';

export async function getAnswerGrid(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    const grid = await buildAnswerGrid(userId);
    return successResponse(grid);
  } catch (err) {
    logger.error('Error building answer grid', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to build answer grid', 500);
  }
}
