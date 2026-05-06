// File: lambda/routes/createCustomCategory.ts
// Purpose: Generate a custom trivia category based on user-provided topic

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { generateCustomCategory } from '../services/bedrock';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';

export async function createCustomCategory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = body.userId as string;
  const topic = body.topic as string;
  const language = body.language as string | undefined;

  // Validate required parameters
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }
  if (!topic || !topic.trim()) {
    return errorResponse('Missing or empty topic', 400);
  }

  try {
    // Generate the custom category
    const customCategory = await generateCustomCategory({
      topic: topic.trim(),
      userId,
      language
    });

    return successResponse(customCategory);
  } catch (err: any) {
    logger.error('Custom category generation error:', err);
    return errorResponse('Failed to generate custom category', 500, err.message, err.name);
  }
}