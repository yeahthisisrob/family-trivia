// File: lambda/routes/getCategories.ts
// Purpose: Get available trivia categories, including system defaults and user's custom categories

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, listObjects } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import * as fs from 'fs';
import * as path from 'path';
import { SystemCategory, CustomCategory, CategoryResponse } from '@family-trivia/shared';
import { logger } from '../services/logger';

export async function getCategories(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Get userId from query string
  const userId = event.queryStringParameters?.userId;
  
  if (!userId) {
    return errorResponse('Missing userId parameter', 400);
  }
  
  try {
    // 1. Get system categories
    const systemCategoriesPath = S3_PATHS.CATEGORIES;
    const systemCategories = await getJson<SystemCategory[]>(systemCategoriesPath) || [];
    
    // 2. Get user's custom categories
    const userCategoriesPath = S3_PATHS.USER_CATEGORIES(userId);
    const userCustomCategories = await getJson<CustomCategory[]>(userCategoriesPath) || [];
    
    // 3. Get the latest custom category (last in the array)
    const lastCustomCategory = userCustomCategories.length > 0 
      ? userCustomCategories[userCustomCategories.length - 1] 
      : undefined;
    
    // Build and return the combined response
    const response: CategoryResponse = {
      systemCategories,
      customCategories: userCustomCategories,
      lastCustomCategory
    };
    
    return successResponse(response);
  } catch (err: any) {
    logger.error('Error fetching categories:', err);
    
    // If system categories file doesn't exist yet, try to load default categories
    if (err.$metadata?.httpStatusCode === 404 || err.name === 'NoSuchKey') {
      try {
        // Try to load default categories from file
        const defaultCategoriesPath = path.join(__dirname, '../default-categories.json');
        if (fs.existsSync(defaultCategoriesPath)) {
          const defaultCategories = JSON.parse(fs.readFileSync(defaultCategoriesPath, 'utf-8'));
          return successResponse({
            systemCategories: defaultCategories,
            customCategories: [],
          });
        }
      } catch (loadError) {
        logger.error('Error loading default categories:', loadError as Error);
      }
      
      return successResponse({
        systemCategories: [],
        customCategories: [],
      });
    }
    
    return errorResponse('Failed to fetch categories', 500, err.message);
  }
}