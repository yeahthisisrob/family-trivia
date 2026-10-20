import { modelFor } from '../core/models';
// File: services/bedrock/questions/customCategory.ts
// Purpose: Generate custom categories from user topics with AI assistance

import { logger } from '../../logger';
import { askStructured } from '../core/converse';
import { isFilled, isRecord } from '../core/shape';
import type { CustomCategory } from '../core/types';

interface CategoryGenerationParams {
  topic: string; // User-provided topic
  userId: string; // User ID for tracking/logging
  language?: string; // Optional language preference
}

interface CategoryGenerationResult {
  title: string;
  description: string;
}

/** A title and a description, both filled in. */
export const isCategory = (v: unknown): v is CategoryGenerationResult =>
  isRecord(v) && isFilled(v.title) && isFilled(v.description);

/**
 * Generate a custom category based on user input
 * Creates an optimized title and description for the category
 */
export async function generateCustomCategory(
  params: CategoryGenerationParams,
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
      language,
    });

    // Call the model to generate the category
    // A category still missing a field after one retry throws (AiOutputInvalid).
    const parsedResponse = await askStructured({
      task: 'trivia',
      prompt,
      maxTokens: 300,
      temperature: 0.7,
      model: modelFor('trivia'),
      name: 'trivia_category',
      description: 'The category title and its description.',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Under 40 characters' },
          description: { type: 'string', description: 'Under 150 characters' },
        },
        required: ['title', 'description'],
      },
      check: isCategory,
      why: () => 'both the title and the description must be filled in',
    });

    // Create the category object
    const customCategory: CustomCategory = {
      id: `custom_${Date.now()}_${userId.substring(0, 8)}`,
      title: parsedResponse.title,
      description: parsedResponse.description,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      type: 'custom',
    };

    return customCategory;
  } catch (error) {
    logger.error('Error generating custom category', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      topic,
    });
    throw new Error('Failed to create custom category. Please try a different topic.');
  }
}
