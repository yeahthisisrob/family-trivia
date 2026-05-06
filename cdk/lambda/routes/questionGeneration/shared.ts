// File: lambda/routes/questionGeneration/shared.ts
// Purpose: Shared question generation logic for regular trivia and game modes

import {
  generateQuestion as generateFromBedrock,
  generateQuestionWithProgress,
  GenerateMode,
  GenerateQuestionOptions,
  DifficultyLevel,
  ProgressMessage,
  Question
} from '../../services/bedrock';
import { generateBestQuestion } from '../../services/questionPipeline';
import { logger } from '../../services/logger';

export interface GenerateQuestionRequest {
  userId: string;
  mode: GenerateMode;
  category?: string;
  difficulty?: DifficultyLevel;
  customPrompt?: string;
  withProgress?: boolean;
  skipDailyCheck?: boolean; // For game modes that generate multiple questions
  questionNumber?: number;   // For showing "Question X of Y" in progress
  totalQuestions?: number;   // Total questions being generated
}

export interface GenerateQuestionResult {
  question: Question;
  messages?: ProgressMessage[];
  factCheckResult?: any;
  retriesNeeded?: number;
}

// Daily limit check lives in playerStateService.checkPlayEligibility() —
// single source of truth, no duplicated logic here.

/**
 * Generate a trivia question with optional progress messages
 */
export async function generateQuestionWithOptions(
  request: GenerateQuestionRequest
): Promise<GenerateQuestionResult> {
  const { 
    userId, 
    mode, 
    category, 
    difficulty, 
    customPrompt, 
    withProgress,
    questionNumber,
    totalQuestions
  } = request;
  
  logger.info('Generating question with shared module', {
    userId,
    mode,
    category,
    difficulty,
    customPrompt: customPrompt ? 'provided' : 'not provided',
    withProgress,
    questionNumber,
    totalQuestions
  });
  
  try {
    // Use the new multi-model pipeline for all question generation.
    // It generates candidates from trivia bank + Sonnet + Haiku in parallel,
    // deduplicates, judges the best, and fact-checks — all in 2-3 Bedrock calls.
    const pipelineResult = await generateBestQuestion({
      userId,
      mode: mode as string,
      category,
      difficulty,
      customPrompt,
    });

    const question = pipelineResult.question;

    // Build progress messages
    const messages: ProgressMessage[] = [];
    const prefix = questionNumber && totalQuestions && totalQuestions > 1
      ? `Question ${questionNumber}: ` : '';

    if (withProgress || (questionNumber && totalQuestions && totalQuestions > 1)) {
      messages.push({
        type: 'checking',
        message: `${prefix}Generated candidates from ${pipelineResult.source}`,
        timestamp: Date.now(),
      });
      if (pipelineResult.factChecked) {
        messages.push({
          type: 'checking',
          message: `${prefix}Fact-checked and verified`,
          timestamp: Date.now() + 200,
        });
      }
      messages.push({
        type: 'success',
        message: `${prefix ? `✅ Question ${questionNumber} complete!` : '✅ Question ready!'}`,
        timestamp: Date.now() + 400,
      });
    }

    return {
      question,
      messages: messages.length > 0 ? messages : undefined,
      factCheckResult: pipelineResult.factChecked ? { isAccurate: true } : undefined,
      retriesNeeded: 0,
    };
  } catch (err: any) {
    logger.error('Question generation error in shared module', {
      userId,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      errorType: err.name
    });
    throw err;
  }
}

/**
 * Validate a generated question
 */
export function validateGeneratedQuestion(question: any): boolean {
  return !!(
    question && 
    question.question && 
    question.choices && 
    Array.isArray(question.choices) &&
    question.choices.length === 4 &&
    question.answer &&
    question.choices.includes(question.answer)
  );
}