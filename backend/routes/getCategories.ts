// File: lambda/routes/getCategories.ts
// Purpose: Get available trivia categories, including system defaults and user's custom categories

import type { CategoryResponse, CustomCategory, SystemCategory } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';
import { getJson } from '../services/s3';
import { seasonCategories } from '../services/seasonService';

export async function getCategories(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  // Get userId from query string
  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return errorResponse('Missing userId parameter', 400);
  }

  try {
    // 1. Get system categories
    const systemCategoriesPath = S3_PATHS.CATEGORIES;
    const systemCategories = await seasonCategories(
      (await getJson<SystemCategory[]>(systemCategoriesPath)) || [],
    );

    // 2. Get user's custom categories
    const userCategoriesPath = S3_PATHS.USER_CATEGORIES(userId);
    const userCustomCategories = (await getJson<CustomCategory[]>(userCategoriesPath)) || [];

    // 3. Get the latest custom category (last in the array)
    const lastCustomCategory =
      userCustomCategories.length > 0
        ? userCustomCategories[userCustomCategories.length - 1]
        : undefined;

    // Build and return the combined response
    const response: CategoryResponse = {
      systemCategories,
      customCategories: userCustomCategories,
      lastCustomCategory,
    };

    return successResponse(response);
  } catch (err: any) {
    logger.error('Error fetching categories:', err);

    return errorResponse('Failed to fetch categories', 500, err.message);
  }
}
