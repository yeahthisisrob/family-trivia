// File: lambda/routes/submitCustomCategory.ts
// Purpose: Save a custom category to S3 for a specific user

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson } from '../services/s3';
import { CustomCategory } from '../services/bedrock';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';

/**
 * Save a custom category to the user's categories collection in S3
 * If the categories file doesn't exist, it will be created
 * If it does exist, the new category will be added to the array
 */
export async function submitCustomCategory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = body.userId as string;
  const category = body.category as CustomCategory;

  // Validate required parameters
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }
  if (!category || !category.id || !category.title) {
    return errorResponse('Invalid category object', 400);
  }

  try {
    // Path for user's custom categories
    const categoriesPath = `categories/${userId}/categories.json`;
    
    // Try to get existing categories or create a new array
    const existingCategories = await getJson<CustomCategory[]>(categoriesPath) || [];
    
    // Check if category with same ID already exists (shouldn't happen with timestamp-based IDs)
    const existingIndex = existingCategories.findIndex(c => c.id === category.id);
    
    if (existingIndex >= 0) {
      // Replace the existing category
      existingCategories[existingIndex] = category;
    } else {
      // Add the new category
      existingCategories.push(category);
    }
    
    // Write back to S3
    await putJson(categoriesPath, existingCategories);
    
    return successResponse({
      success: true,
      message: 'Custom category saved successfully',
      categoryId: category.id,
      totalCategories: existingCategories.length
    });
  } catch (err: any) {
    logger.error('Error saving custom category:', err);
    return errorResponse('Failed to save custom category', 500, err.message, err.name);
  }
}