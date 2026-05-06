// File: services/bedrock/questions/trivia.ts
// Purpose: Generate general trivia questions with difficulty levels

import { POINT_MULTIPLIERS, MAX_RETRY_ATTEMPTS } from '../core/constants';
import { collectResponseBody, extractJsonFromResponse } from '../core/responseParser';
import { invokeBedrockPrompt } from '../core/bedrockClient';
import { Question, QuestionHistory, GenerateQuestionOptions, DifficultyLevel } from '../core/types';
import { buildTriviaPrompt } from './prompts';
import { getJson, listObjects } from '../../s3';
import { getFactContent } from '../../factHistoryService';
import { getUserGroup } from '../../users';
import { isDuplicateQuestion, getPreviousCustomCategoryQuestions } from './utils';
import { getAllQuestionsFlat, getAllUserHistories } from '../../questionHistoryService';
import { logger } from '../../../services/logger';
import { getModelForService } from '../../../config';
import { externalTriviaS3Service } from '../../externalTriviaS3';

/**
 * Validates the question object to ensure it meets the expected format
 * and detects circular or obvious questions where the answer appears in the question
 */
export function validateQuestion(question: any): boolean {
  try {
    // Check required fields
    if (!question || typeof question !== 'object') return false;
    if (typeof question.question !== 'string' || !question.question.trim()) return false;
    if (!Array.isArray(question.choices) || question.choices.length !== 4) return false;
    if (typeof question.answer !== 'string' || !question.choices.includes(question.answer)) return false;

    // Check for circular/obvious questions where the answer appears in the question
    const questionText = question.question.toLowerCase();
    const answerText = question.answer.toLowerCase();
    
    // Check if the answer appears verbatim in the question
    if (questionText.includes(answerText)) {
      logger.warn('Circular question detected: answer appears in the question text', { 
        question: question.question, 
        answer: question.answer 
      });
      return false;
    }
    
    // Check for questions that are too obvious or circular by looking for significant overlapping words
    // Skip for very short answers (1-2 words) as they might naturally appear in many questions
    if (answerText.split(' ').length > 2) {
      // Get the significant words from the answer (excluding common words)
      const answerWords = answerText.split(' ')
        .filter((word: string) => word.length > 3) // Skip short words like "a", "the", "and", etc.
        .map((word: string) => word.replace(/[.,?!;:'"()]/g, '')); // Remove punctuation
      
      // Count how many significant words from the answer appear in the question
      const matchingWords = answerWords.filter((word: string) => 
        word.length > 3 && questionText.includes(word)
      );
      
      // If more than half of the significant words in the answer appear in the question, reject it
      if (matchingWords.length > 0 && matchingWords.length >= answerWords.length / 2) {
        logger.warn('Obvious/circular question detected: too many answer words appear in question', { 
          question: question.question, 
          answer: question.answer,
          matchingWords 
        });
        return false;
      }
    }
    
    // Check for "What is X? Answer: X" pattern
    if (questionText.startsWith("what is") || questionText.startsWith("which")) {
      // Extract the main subject of the question
      const questionSubject = questionText
        .replace(/^what is |^which |[?.,;:!]/g, '')
        .trim();
      
      // If the answer is the full or significant part of the question subject, reject it
      if (questionSubject === answerText || 
          (questionSubject.includes(answerText) && answerText.length > 3) ||
          (answerText.includes(questionSubject) && questionSubject.length > 3)) {
        logger.warn('Circular "What is X? Answer: X" pattern detected', { 
          question: question.question, 
          answer: question.answer,
          questionSubject
        });
        return false;
      }
    }

    // All checks passed
    return true;
  } catch (e) {
    logger.error('Question validation error', { 
      error: e instanceof Error ? e.message : String(e) 
    });
    return false;
  }
}

/**
 * Try to get an external trivia question if available
 */
async function tryGetExternalQuestion(
  category: string | undefined,
  difficulty: DifficultyLevel,
  excludedQuestionIds: string[]
): Promise<Question | null> {
  try {
    // Only use external questions for standard categories, not custom ones
    if (!category || category.includes('Custom:')) {
      return null;
    }
    
    const externalQuestion = await externalTriviaS3Service.getRandomQuestion(
      category,
      difficulty,
      excludedQuestionIds
    );
    
    if (!externalQuestion) {
      return null;
    }
    
    // Convert external question to our Question format
    const question: Question = {
      question: externalQuestion.question,
      choices: externalQuestion.choices,
      answer: externalQuestion.answer,
      category: externalQuestion.category,
      difficulty: externalQuestion.difficulty || difficulty,
      pointMultiplier: POINT_MULTIPLIERS[difficulty],
      source: externalQuestion.source,
      sourceUrl: externalQuestion.sourceUrl,
      externalId: externalQuestion.externalId
    };
    
    // Validate the external question
    if (!validateQuestion(question)) {
      logger.warn('External question failed validation', { 
        externalId: externalQuestion.externalId,
        question: question.question.substring(0, 100),
        answer: question.answer,
        choicesLength: question.choices.length,
        answerInChoices: question.choices.includes(question.answer)
      });
      return null;
    }
    
    return question;
  } catch (error) {
    logger.error('Error getting external question', error as Error);
    return null;
  }
}

/**
 * Base function to generate a single trivia question without retry logic
 * Used by the step-by-step generation process
 */
export async function generateTriviaQuestionBase(
  options: GenerateQuestionOptions,
  userId?: string
): Promise<{ question: Question; attempts: number; modelUsed: string }> {
  const { mode, category, difficulty = 'normal', customPrompt, excludedQuestions = [] } = options;
  
  const pointMultiplier = POINT_MULTIPLIERS[difficulty];
  const validDifficulties: DifficultyLevel[] = ['easy', 'normal', 'hard'];
  
  if (!validDifficulties.includes(difficulty)) {
    throw new Error(`Invalid difficulty level: ${difficulty}. Must be one of: ${validDifficulties.join(', ')}`);
  }
  
  // Try to get an external question first for category mode
  if (mode === 'category' && category && !customPrompt) {
    logger.info('Attempting to get external question', {
      category,
      difficulty,
      mode,
      hasCustomPrompt: !!customPrompt
    });
    
    const excludedIds = [...excludedQuestions.map(q => (q as any).externalId).filter(Boolean)];
    const maxExternalAttempts = 3;
    
    // Try up to 3 times to get a valid external question
    for (let attempt = 1; attempt <= maxExternalAttempts; attempt++) {
      const externalQuestion = await tryGetExternalQuestion(category, difficulty, excludedIds);
      
      if (externalQuestion) {
        logger.info('Using external trivia question', {
          category,
          difficulty,
          source: externalQuestion.source,
          externalId: (externalQuestion as any).externalId,
          attempt
        });
        
        return {
          question: externalQuestion,
          attempts: attempt,
          modelUsed: 'external'
        };
      } else {
        logger.info(`External question attempt ${attempt} failed`, {
          category,
          difficulty,
          excludedIdsCount: excludedIds.length
        });
        
        // Add a small delay between attempts
        if (attempt < maxExternalAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
    
    logger.info('All external question attempts failed, falling back to AI', {
      category,
      difficulty,
      excludedIdsCount: excludedIds.length
    });
  }

  const parts: string[] = [];
  
  if (customPrompt?.trim()) {
    parts.push(`User instruction: ${customPrompt.trim()}`);
  }
  
  // Add excluded questions if any are provided
  if (excludedQuestions.length > 0) {
    parts.push(`\nIMPORTANT: Do NOT generate questions similar to the following rejected questions:\n${excludedQuestions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}\n\nEnsure your question is substantially different from these.`);
  }
  
  // Mode-specific prompt building would go here
  // For now, keeping it simple for category and custom modes
  
  if (mode === 'category') {
    // Get valid categories from S3
    const validCategories = await getJson<{name: string, description: string}[]>('categories/categories.json') || [];
    const validCategoryNames = validCategories.map(c => c.name);

    if (!validCategoryNames.includes(category!)) {
      logger.warn(`Potentially invalid category '${category}'. Proceeding anyway.`);
    }
    parts.push(`Category: ${category}`);
  }
  
  if (mode === 'custom') {
    logger.info("Using custom category mode", { category });
    
    if (!category) {
      logger.error("Missing category for custom mode");
      throw new Error('Missing category for custom mode');
    }
    parts.push(`Custom Category: ${category}`);
    parts.push(`Generate trivia questions about "${category}"`);
    
    // Get previous custom category questions for this user if userId is provided
    if (userId) {
      const previousCustomQuestions = await getPreviousCustomCategoryQuestions(category, userId);
      
      if (previousCustomQuestions.length > 0) {
        logger.info('Including previous custom category questions to avoid duplicates', {
          category,
          previousCount: previousCustomQuestions.length
        });
        
        // Already limited to 25 in the function, so just use them all
        parts.push(`\nIMPORTANT: The following questions have already been asked in this custom category. Generate a DIFFERENT question that doesn't duplicate these:\n${previousCustomQuestions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}\n\nYour question must be substantially different from all of these.`);
      }
    }
  }

  const fullPrompt = buildTriviaPrompt(parts, difficulty);
  
  const temperature = 0.7;
  const modelId = getModelForService('QUESTION_GENERATION');
  
  logger.info(`Generating question`, { 
    mode, 
    category: category || 'none', 
    temperature,
    promptParts: parts.slice(0, 2),
    excludedQuestionsCount: excludedQuestions.length,
    modelId
  });

  const bodyStream = await invokeBedrockPrompt(fullPrompt, 512, temperature, {}, modelId);
  const responseBuffer = await collectResponseBody(bodyStream);
  const parsedResponse = extractJsonFromResponse(responseBuffer, modelId);
  
  if (parsedResponse.rawText) {
    logger.error('Model returned raw text instead of JSON question format', {
      textPreview: parsedResponse.rawText.slice(0, 500),
      modelId,
      category: category || 'none',
      mode: mode,
      fullPrompt: fullPrompt.slice(0, 500)
    });
    throw new Error('Model returned raw text instead of structured question JSON');
  }
  
  const questionObj = parsedResponse;
  
  if (!validateQuestion(questionObj)) {
    logger.error('Question validation failed', {
      questionObj,
      hasQuestion: !!questionObj?.question,
      hasChoices: !!questionObj?.choices,
      choicesLength: questionObj?.choices?.length,
      hasAnswer: !!questionObj?.answer,
      answerInChoices: questionObj?.choices?.includes(questionObj?.answer),
      modelId,
      category
    });
    throw new Error('Invalid question format in response');
  }
  
  // Add metadata
  if (category) {
    logger.debug(`Using provided category for question`, { category, mode });
    questionObj.category = category;
  } else if (questionObj.category) {
    logger.debug(`Using model-generated category`, { category: questionObj.category });
  } else {
    logger.debug(`No category available, using mode as category`, { mode });
    questionObj.category = mode;
  }
  
  questionObj.difficulty = difficulty;
  questionObj.pointMultiplier = pointMultiplier;
  
  return {
    question: questionObj,
    attempts: 1,
    modelUsed: modelId
  };
}

/**
 * Generate a multiple-choice trivia question via Bedrock
 * Now with duplicate question checking across all users
 */
export async function generateQuestion(
  userId: string,
  opts: GenerateQuestionOptions,
  maxRetries = 5
): Promise<Question> {
  const { mode, category, customPrompt, difficulty = 'normal', previousQuestions = [] } = opts;

  // Input validation for category mode
  if (mode === 'category' && !category) {
    throw new Error(`'category' must be provided in category mode.`);
  }

  try {
    // Load user data
    const groupId = await getUserGroup(userId);
    if (mode === 'group' && !groupId) {
      throw new Error(`No group found for userId: ${userId}`);
    }
    
    // Load all previous questions (cached per invocation — no duplicate S3 reads)
    const cachedQuestions = await getAllQuestionsFlat() as Question[];
    const recentQuestions = [...previousQuestions, ...cachedQuestions];
    logger.info('Checking question history to avoid duplicates', {
      recentQuestionsCount: recentQuestions.length,
    });

    // Set point multiplier based on difficulty
    const pointMultiplier = POINT_MULTIPLIERS[difficulty];

    // Build prompt parts based on mode
    const parts: string[] = [];

    if (customPrompt?.trim()) {
      parts.push(`User instruction: ${customPrompt.trim()}`);
    }

    if (mode === 'personal') {
      const factContent = await getFactContent(userId);
      const recentFacts = factContent.slice(-5).map(f => `${f.question}: ${f.answer}`);
      if (recentFacts.length > 0) {
        parts.push(`Here are some personal facts about the user:\n${recentFacts.join('\n')}`);
      }
    }

    if (mode === 'history') {
      const allHistories = await getAllUserHistories();
      const correctEntries: QuestionHistory[] = [];
      for (const history of allHistories.values()) {
        for (const entry of history) {
          if ((entry as any).correct) correctEntries.push(entry as any);
        }
      }
      const flat = correctEntries;
      flat.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const recent10 = flat.slice(0, 10);
      const recentCats = recent10
        .map(entry => entry.question.category)
        .filter((c): c is string => Boolean(c));
      if (recentCats.length > 0) {
        parts.push(`Recent correctly answered categories: ${recentCats.join(', ')}`);
      }
    }

    if (mode === 'group') {
      parts.push(`Group: ${groupId}`);
    }

    if (mode === 'category') {
      // Get valid categories from S3
      const validCategories = await getJson<{name: string, description: string}[]>('categories/categories.json') || [];
      const validCategoryNames = validCategories.map(c => c.name);

      if (!validCategoryNames.includes(category!)) {
        console.warn(`Potentially invalid category '${category}'. Proceeding anyway.`);
      }
      parts.push(`Category: ${category}`);
    }
    
    if (mode === 'custom') {
      // For custom mode, we don't validate against TRIVIA_CATEGORIES
      // We just use the category name as-is
      logger.info("Using custom category mode", { category });
      
      if (!category) {
        logger.error("Missing category for custom mode");
        throw new Error('Missing category for custom mode');
      }
      parts.push(`Custom Category: ${category}`);
      
      // Also add a topic prompt for more context
      parts.push(`Generate trivia questions about "${category}"`);
      
      // Get previous custom category questions to avoid duplicates for this user
      const previousCustomQuestions = await getPreviousCustomCategoryQuestions(category, userId);
      
      if (previousCustomQuestions.length > 0) {
        logger.info('Including previous custom category questions to avoid duplicates', {
          category,
          userId,
          previousCount: previousCustomQuestions.length
        });
        
        // Already limited to 25 in the function, so just use them all
        parts.push(`\nIMPORTANT: The following questions have already been asked in this custom category. Generate a DIFFERENT question that doesn't duplicate these:\n${previousCustomQuestions.map((q, i) => `${i + 1}. "${q}"`).join('\n')}\n\nYour question must be substantially different from all of these.`);
      }
    }

    // Build the full prompt
    const fullPrompt = buildTriviaPrompt(parts, difficulty);

    // Try up to MAX_RETRY_ATTEMPTS times to get a valid response
    let attempts = 0;
    
    while (attempts < MAX_RETRY_ATTEMPTS) {
      attempts++;
      
      try {
        // Adjust temperature slightly on retry for variation
        // Keep temperature within valid range (0-1)
        const temperature = Math.min(0.7 + (attempts - 1) * 0.1, 1.0);
        const modelId = getModelForService('QUESTION_GENERATION');
        
        logger.info(`Generating question`, { 
          attempt: attempts, 
          maxAttempts: MAX_RETRY_ATTEMPTS, 
          mode, 
          category: category || 'none', 
          temperature,
          promptParts: parts.slice(0, 2), // Log first parts of prompt for debugging
          modelId
        });

        // Invoke Bedrock
        const bodyStream = await invokeBedrockPrompt(fullPrompt, 512, temperature, {}, modelId);
        
        // Collect response and extract JSON
        const responseBuffer = await collectResponseBody(bodyStream);
        const parsedResponse = extractJsonFromResponse(responseBuffer, modelId);
        
        // Check if we got raw text instead of JSON (happens with some models)
        if (parsedResponse.rawText) {
          logger.error('Model returned raw text instead of JSON question format', {
            textPreview: parsedResponse.rawText.slice(0, 500),
            modelId,
            category: category || 'none',
            mode: mode,
            fullPrompt: fullPrompt.slice(0, 500) // Log part of prompt for debugging
          });
          throw new Error('Model returned raw text instead of structured question JSON');
        }
        
        const questionObj = parsedResponse;
        
        // Validate question format
        if (!validateQuestion(questionObj)) {
          throw new Error('Invalid question format in response');
        }
        
        // Add the category and difficulty we already have, plus point multiplier
        if (category) {
          logger.debug(`Using provided category for question`, { category, mode });
          questionObj.category = category;
        } else if (questionObj.category) {
          logger.debug(`Using model-generated category`, { category: questionObj.category });
        } else {
          logger.debug(`No category available, using mode as category`, { mode });
          questionObj.category = mode; // Fallback to using mode as category name
        }
        
        questionObj.difficulty = difficulty;
        questionObj.pointMultiplier = pointMultiplier;
        
        // Check if this is a duplicate question using the recent questions
        if (isDuplicateQuestion(questionObj, recentQuestions)) {
          logger.warn(`Detected duplicate question`, { 
            questionText: questionObj.question.substring(0, 50) + (questionObj.question.length > 50 ? '...' : ''),
            mode,
            category: questionObj.category
          });
          
          // If we've reached our retry limit, add a small randomization to make it at least slightly different
          if (maxRetries <= 0) {
            logger.warn('Reached max retries, returning slightly modified question');
            questionObj.question = `${questionObj.question} (Alternative version)`;
            return questionObj;
          }
          
          // Otherwise, try again with the complete history including this question
          // We append the current question to the full history, not just previousQuestions
          const updatedHistory = [...recentQuestions, questionObj];
          
          return generateQuestion(userId, {
            ...opts,
            previousQuestions: updatedHistory
          }, maxRetries - 1);
        }
        
        logger.info('Successfully generated question', {
          category: questionObj.category,
          difficulty,
          questionLength: questionObj.question.length
        });
        return questionObj;
      } catch (error) {
        logger.error(`Error generating question`, {
          attempt: attempts,
          maxAttempts: MAX_RETRY_ATTEMPTS,
          mode,
          category: category || 'none',
          error: error instanceof Error ? error.message : String(error)
        });
        
        // If this was our last attempt, throw the error
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          throw new Error(`Failed to generate a valid question after ${MAX_RETRY_ATTEMPTS} attempts`);
        }
        // Otherwise continue to next attempt
      }
    }
    
    // This should not be reached due to the throw above
    throw new Error('Failed to generate a valid question');
  } catch (error) {
    logger.error('Error in question generation process', {
      userId,
      mode,
      category: category || 'none',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}