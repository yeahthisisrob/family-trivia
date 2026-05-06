import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { buildFactGrid } from '../services/factGridService';

export async function getFactGrid(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const grid = await buildFactGrid(userId);
    return successResponse(grid);
  } catch (err) {
    logger.error('Error building fact grid', {
      userId, error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to build fact grid', 500);
  }
}
