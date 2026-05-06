// Module: facts
// Daily facts, fact history, and fact generation

import { apiService } from '../../services/ApiService';
import { cacheService } from '../../services/CacheService';
import { createLogger } from '../../utils/logger';

import type {
  DailyFactQuestion,
  DailyFactResult,
  RecentQuestion,
  GenerateOptionsResponse,
  UserFactHistory,
} from '@family-trivia/shared';

export type {
  DailyFactQuestion,
  DailyFactResult,
  RecentQuestion,
  QuestionOption,
  GenerateOptionsResponse,
  FactHistoryItem,
  UserFactHistory,
} from '@family-trivia/shared';

const logger = createLogger('FactsAPI');

/**
 * Check if we should show the daily fact prompt to a user
 * @param userId User ID to check
 * @returns True if the user has a pending unanswered fact question or basic questions to catch up on
 */
export async function shouldShowDailyFact(userId: string): Promise<boolean> {
  try {
    // Get the user's daily fact status
    const result = await getDailyFact(userId);

    // If the question is not answered, show it
    if (!result.answered) {
      logger.debug(`User ${userId} has an unanswered question, showing it`);
      return true;
    }

    // If the user has answered today's question but needs basic catchup,
    // check if there are catchup questions available
    if (result.answered && result.needsBasicCatchup) {
      logger.debug(`User ${userId} needs basic catchup, checking for catchup questions`);
      try {
        // Try to get a catchup question
        const catchupResult = await getDailyFact(userId, true);
        return !catchupResult.answered; // If we get an unanswered catchup question, show it
      } catch (err) {
        logger.error('Error checking for catchup questions', err);
        return false;
      }
    }

    // If this user has answered a basic question today,
    // check if the shared question exists and needs an answer
    if (result.answered && result.questionType === 'basic' && !result.needsBasicCatchup) {
      logger.debug(`User ${userId} completed basic questions, checking shared question`);
      try {
        // Force fetch the shared question
        const sharedResult = await getDailyFact(userId, false, true);
        if (sharedResult && !sharedResult.answered) {
          return true; // Shared question needs to be answered
        }
      } catch (err) {
        logger.error('Error checking for shared question:', err);
      }
    }

    // Otherwise, don't show anything
    return false;
  } catch (err) {
    logger.error('Error in shouldShowDailyFact:', err);
    return true; // Default to showing in case of error
  }
}

/**
 * Get the daily fact question for a user
 *
 * The system works as follows:
 * 1. New users complete basic questions first (e.g., "What's your favorite color?")
 * 2. Once they've completed all basic questions, they get the shared daily question
 * 3. The first user to request the shared question for a day generates it for everyone
 *
 * If catchup is true, users who have already answered their daily question but haven't
 * completed basic questions will get their next basic question to answer immediately.
 *
 * If forceShared is true, the system will specifically request the shared daily question
 * regardless of whether the user has already answered their own question.
 *
 * @param userId User ID to get fact for
 * @param catchup Whether to allow catching up on basic questions if daily question is complete
 * @param forceShared Whether to force fetch the shared daily question
 * @returns The daily fact question
 */
export async function getDailyFact(
  userId: string,
  catchup = false,
  forceShared = false,
): Promise<DailyFactQuestion> {
  const today = new Date().toISOString().split('T')[0];

  // If catchup mode is enabled, include it in the request and bypass cache
  if (catchup) {
    return apiService.request<DailyFactQuestion>(
      `/daily-fact?userId=${encodeURIComponent(userId)}&catchup=true`,
      { method: 'GET' },
      undefined, // Bypass cache in catchup mode
    );
  }

  // If forceShared is true, specifically request the shared question
  if (forceShared) {
    return apiService.request<DailyFactQuestion>(
      `/daily-fact?userId=${encodeURIComponent(userId)}&forceShared=true`,
      { method: 'GET' },
      undefined, // Bypass cache when forcing shared question
    );
  }

  return apiService.request<DailyFactQuestion>(
    `/daily-fact?userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
    `daily_fact_${userId}_${today}`,
  );
}

/**
 * Submit a daily fact answer and get an interesting response
 * @param userId User ID submitting the answer
 * @param question The question being answered
 * @param answer The user's answer
 * @param catchupMode If this is a catch-up question rather than the daily question
 * @param questionIndex Optional index of the basic question
 * @returns The AI-generated fact response
 */
export async function submitDailyFact(
  userId: string,
  question: string,
  answer: string,
  catchupMode = false,
  questionIndex?: number,
): Promise<DailyFactResult> {
  const today = new Date().toISOString().split('T')[0];
  cacheService.invalidate(`daily_fact_${userId}_${today}`);
  cacheService.invalidate(`user_profile_${userId}`);

  return apiService.request<DailyFactResult>('/submit-daily-fact', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      question,
      answer,
      catchupMode,
      questionIndex,
    }),
  });
}

/**
 * Skip the daily fact, marking it as answered without generating a response
 * @param userId User ID skipping the question
 * @param question The question being skipped
 * @param catchupMode If this is a catch-up question rather than the daily question
 * @param questionIndex Optional index of the basic question
 * @returns A basic response message
 */
export async function skipDailyFact(
  userId: string,
  question: string,
  catchupMode = false,
  questionIndex?: number,
): Promise<DailyFactResult> {
  const today = new Date().toISOString().split('T')[0];
  cacheService.invalidate(`daily_fact_${userId}_${today}`);
  cacheService.invalidate(`user_profile_${userId}`);

  return apiService.request<DailyFactResult>('/submit-daily-fact', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      question,
      answer: '[Skipped]',
      skipped: true,
      catchupMode,
      questionIndex,
    }),
  });
}

/**
 * Generate daily fact question with user-provided theme
 * @param userId User ID generating the question
 * @param theme Theme or words to inspire the question
 * @param regenerate Whether to regenerate a new question (force regeneration)
 * @returns The generated question
 */
export async function generateDailyFactWithTheme(
  userId: string,
  theme: string,
  regenerate = false,
): Promise<DailyFactQuestion> {
  const today = new Date().toISOString().split('T')[0];
  cacheService.invalidate(`daily_fact_${userId}_${today}`);

  return apiService.request<DailyFactQuestion>('/daily-fact', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      theme,
      regenerate,
    }),
  });
}

/**
 * Generate multiple question options for first person
 * @param userId User ID generating the questions
 * @param theme Optional theme to focus on
 * @param regenerate Whether to regenerate new options
 * @returns List of question options
 */
export async function generateQuestionOptions(
  userId: string,
  theme = '',
  regenerate = false,
): Promise<GenerateOptionsResponse> {
  return apiService.request<GenerateOptionsResponse>('/generate-question-options', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      theme,
      regenerate,
    }),
  });
}

/**
 * Get recent shared questions
 * @param limit Number of questions to return (default 6)
 * @returns List of recent shared questions
 */
export async function getRecentSharedQuestions(limit = 6): Promise<RecentQuestion[]> {
  const response = await apiService.request<{ questions: RecentQuestion[] }>(
    `/recent-shared-questions?limit=${limit}`,
    { method: 'GET' },
  );
  return response.questions || [];
}

/**
 * Get all historical daily facts for a user
 * @param userId User ID to get history for
 * @param includeGlobal Whether to include all global shared questions
 * @returns User's fact history with basic questions and optionally all shared questions
 */
export async function getUserFactHistory(
  userId: string,
  includeGlobal = true,
): Promise<UserFactHistory> {
  return apiService.request<UserFactHistory>(
    `/user-fact-history?userId=${encodeURIComponent(userId)}&includeGlobal=${includeGlobal}`,
    { method: 'GET' },
  );
}

/**
 * Submit or update a historical daily fact answer
 * @param params Parameters for submitting historical fact
 * @returns Result with generated fact
 */
export async function submitHistoricalFact(params: {
  userId: string;
  question: string;
  answer: string;
  date: string;
  questionType: 'basic' | 'shared';
  questionIndex?: number;
  skipped?: boolean;
}): Promise<DailyFactResult> {
  // Invalidate caches
  cacheService.invalidate(`user_profile_${params.userId}`);

  return apiService.request<DailyFactResult>('/submit-historical-fact', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get all family fact answers for client-side fuzzy autocomplete.
 * Returns deduplicated answers with author names.
 */
/**
 * Get common opening phrases extracted from real family answers.
 * Used for autocomplete starters — just patterns, no individual answers.
 */
export async function getFactStarters(): Promise<string[]> {
  const result = await apiService.request<{ starters: string[] }>(
    '/fact-suggestions',
    { method: 'GET' },
    'fact_suggestions',
  );
  return result.starters || [];
}
