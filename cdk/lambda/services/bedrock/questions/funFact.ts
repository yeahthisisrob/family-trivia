// File: services/bedrock/questions/funFact.ts
// Purpose: Generate fun facts based on user answers

import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody } from '../core/responseParser';
import { extractTextContent } from '../core/textExtractor';
import { buildFunFactPrompt } from './prompts';
import { logger } from '../../logger';
import { getModelForService } from '../../../config';

/**
 * Generate a single short, fun fact based on the user's last answer
 */
export async function generateFunFact(
  userId: string,
  question: string,
  answer: string
): Promise<string> {
  const prompt = buildFunFactPrompt(question, answer);

  try {
    const funFactModel = getModelForService('FUN_FACTS');
    const bodyStream = await invokeBedrockPrompt(prompt, 512, 0.7, {}, funFactModel);
    
    // Collect response and extract content
    const responseBuffer = await collectResponseBody(bodyStream);
    
    // Extract text content using utility
    const factText = extractTextContent(responseBuffer, funFactModel, 'fact');
    return factText || "That's a neat answer!";
  } catch (error) {
    logger.error('Error generating fun fact', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userId,
      question: question.substring(0, 100)
    });
    return "That's a neat answer!";
  }
}