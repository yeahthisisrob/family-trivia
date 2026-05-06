// File: services/bedrock/questions/personal.ts
// Purpose: Generate personalized questions based on user facts

import { MAX_RETRY_ATTEMPTS } from '../core/constants';
import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody } from '../core/responseParser';
import { extractTextContent } from '../core/textExtractor';
import { buildUniqueQuestionPrompt, buildUniqueSharedQuestionPrompt } from './prompts';
import { getJson, listObjects } from '../../s3';
import { getFactHistory, getAllFactHistories } from '../../factHistoryService';
import { isDuplicateQuestionString } from './utils';
import { logger } from '../../../services/logger';
import { getModelForService } from '../../../config';

/**
 * Generate a unique personal question that hasn't been asked before
 * @param userId The user ID to generate a question for
 * @param previousQuestions Optional array of questions that have already been asked
 * @param isShared Whether this is a shared question that needs to check across all users
 * @param userTheme Optional theme or words provided by the first user
 * @returns A unique question string
 */
export async function generateUniqueQuestion(
  userId: string,
  previousQuestions: string[] = [],
  isShared: boolean = false,
  userTheme?: string
): Promise<string> {
  const allPreviousQuestions: string[] = [...previousQuestions];

  if (isShared) {
    // For shared questions, we need to be smarter about checking uniqueness
    logger.info('Generating shared question', { userId });

    // First, get all previous shared questions
    const sharedKeys = await listObjects('facts/daily/shared/');
    for (const key of sharedKeys) {
      try {
        const data = await getJson<any>(key);
        if (data?.question) {
          allPreviousQuestions.push(data.question);
        }
      } catch (err) {
        logger.debug('Error reading shared question', { 
          key,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Also sample user answers for question dedup
    const allHistories = await getAllFactHistories();
    for (const entries of allHistories.values()) {
      for (const e of entries) {
        if (e.question) allPreviousQuestions.push(e.question);
      }
    }

    logger.info('Found previous shared questions', {
      count: allPreviousQuestions.length,
    });
  } else {
    // For individual questions, just check the user's history
    const entries = await getFactHistory(userId);
    for (const e of entries) {
      if (e.question) allPreviousQuestions.push(e.question);
    }

    logger.info('Found previous questions for user', { 
      userId, 
      count: allPreviousQuestions.length 
    });
  }

  // Build the appropriate prompt based on whether this is a shared question or not
  // Note: We still pass previousQuestions here because daily fact questions
  // need to avoid duplicates within the prompt itself (not by regenerating)
  const prompt = isShared 
    ? buildUniqueSharedQuestionPrompt(allPreviousQuestions.slice(0, 10), userTheme)
    : buildUniqueQuestionPrompt(allPreviousQuestions.slice(0, 10));

  // Try up to MAX_RETRY_ATTEMPTS times to get a valid question
  let attempts = 0;

  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;

    try {
      // Adjust temperature slightly on retry for variation
      // Keep temperature within valid range (0-1)
      const temperature = Math.min(0.7 + (attempts - 1) * 0.1, 1.0);

      // Call Bedrock API
      const personalQuestionsModel = getModelForService('PERSONAL_QUESTIONS');
      const bodyStream = await invokeBedrockPrompt(prompt, 128, temperature, {}, personalQuestionsModel);

      // Parse the response
      const responseBuffer = await collectResponseBody(bodyStream);
      
      // Extract text content using utility
      const questionText = extractTextContent(responseBuffer, personalQuestionsModel, 'question');

      if (!questionText) {
        throw new Error('No question text in response');
      }

      // Clean up the response - remove quotation marks if present
      const cleanedQuestion = questionText
        .replace(/^["']|["']$/g, '') // Remove quotes at beginning/end
        .replace(/^Question: /i, ''); // Remove any "Question:" prefix

      // Check if this question is too similar to a previously asked question
      if (isDuplicateQuestionString(cleanedQuestion, allPreviousQuestions)) {
        logger.warn('Detected duplicate personal question', {
          userId,
          isShared,
          question: cleanedQuestion.substring(0, 50) + (cleanedQuestion.length > 50 ? '...' : ''),
          attempt: attempts
        });

        if (attempts >= MAX_RETRY_ATTEMPTS) {
          // On the last attempt, return with a slight modification
          logger.warn('Reached max retries, returning modified question', { userId, isShared });
          return `${cleanedQuestion} (alternative)`;
        }

        // Continue to next attempt
        continue;
      }

      logger.info('Successfully generated unique question', {
        userId,
        isShared,
        questionLength: cleanedQuestion.length
      });
      return cleanedQuestion;
    } catch (error) {
      logger.error('Error generating unique question', {
        userId,
        isShared,
        attempt: attempts,
        maxAttempts: MAX_RETRY_ATTEMPTS,
        error: error instanceof Error ? error.message : String(error)
      });

      // On last attempt, throw the error
      if (attempts >= MAX_RETRY_ATTEMPTS) {
        throw new Error(`Failed to generate a unique question after ${MAX_RETRY_ATTEMPTS} attempts`);
      }
      // Otherwise continue to next attempt
    }
  }

  throw new Error('Failed to generate a unique question');
}