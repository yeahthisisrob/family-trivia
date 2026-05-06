// File: services/bedrock/questions/customCategory.ts
// Purpose: Generate custom categories from user topics with AI assistance

import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from '../core/responseParser';
import { CustomCategory } from '../core/types';
import { logger } from '../../logger';
import { getModelForService } from '../../../config';

interface CategoryGenerationParams {
  topic: string;      // User-provided topic
  userId: string;     // User ID for tracking/logging
  language?: string;  // Optional language preference
}

interface CategoryGenerationResult {
  title: string;
  description: string;
}

/**
 * Generate a custom category based on user input
 * Creates an optimized title and description for the category
 */
export async function generateCustomCategory(
  params: CategoryGenerationParams
): Promise<CustomCategory> {
  const { topic, userId, language = 'en' } = params;
  
  // Prepare prompt for the model
  const prompt = `
    Create a concise, engaging trivia category based on this topic: "${topic}".
    
    Return a JSON object with:
    1. "title": A clear, concise name for the category (keep under 40 characters)
    2. "description": A single paragraph description explaining what types of questions 
       will be in this category (keep under 150 characters)
    
    Make the title catchy but accurate to the topic.
    Make the description informative and engaging.
    
    JSON format only:
    {
      "title": "Category Title",
      "description": "Category description that explains what questions will be about."
    }
  `;

  try {
    // Log this operation for analytics
    logger.info('Generating custom category', {
      userId,
      topic,
      language
    });
    
    // Call the model to generate the category
    const customCategoryModel = getModelForService('CUSTOM_CATEGORIES');
    const bodyStream = await invokeBedrockPrompt(prompt, 300, 0.7, {}, customCategoryModel);
    
    // Collect response and extract JSON
    const responseBuffer = await collectResponseBody(bodyStream);
    const parsedResponse = extractJsonFromResponse(responseBuffer, customCategoryModel) as CategoryGenerationResult;
    
    // Validate the response
    if (!parsedResponse) {
      logger.error('Failed to extract valid JSON from response', {
        userId,
        topic
      });
      throw new Error("Failed to generate a valid category format");
    }
    
    // Validate the response has the required fields
    if (!parsedResponse.title || !parsedResponse.description) {
      throw new Error("Generated category is missing required fields");
    }
    
    // Create the category object
    const customCategory: CustomCategory = {
      id: `custom_${Date.now()}_${userId.substring(0, 8)}`,
      title: parsedResponse.title,
      description: parsedResponse.description,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      type: 'custom'
    };
    
    return customCategory;
    
  } catch (error) {
    logger.error('Error generating custom category', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      topic
    });
    throw new Error("Failed to create custom category. Please try a different topic.");
  }
}