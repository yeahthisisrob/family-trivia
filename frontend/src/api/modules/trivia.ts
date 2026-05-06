// Module: trivia
// Question generation, answers, question steps, and categories

import { apiService } from '../../services/ApiService';
import { cacheService } from '../../services/CacheService';
import { createLogger } from '../../utils/logger';

import type {
  Question,
  QuestionWithProgress,
  GenerateMode,
  DifficultyLevel,
  CatchupStatus,
  QuestionStatus,
  QuestionAvailability,
  CustomCategory,
  CategoryResponse,
  Step1Request,
  Step1Response,
  Step2Request,
  Step2Response,
  Step3Request,
  Step3Response,
  StepProgress,
} from '@family-trivia/shared';

export type {
  Question,
  ProgressMessage,
  FactCheckResult,
  QuestionWithProgress,
  GenerateMode,
  DifficultyLevel,
  CatchupStatus,
  QuestionStatus,
  QuestionAvailability,
  SystemCategory,
  CustomCategory,
  CategoryResponse,
  Step1Response,
  Step2Response,
  Step3Response,
  StepProgress,
} from '@family-trivia/shared';

// ── Questions ───────────────────────────────────────────────────────────────

const questionLogger = createLogger('QuestionAPI');

/**
 * Generate a new trivia question via AI (Bedrock).
 * - mode controls the style/source of the question.
 * - category is required if mode === 'category'.
 */
export async function generateQuestion(
  userId: string,
  mode: GenerateMode,
  customPrompt?: string,
  category?: string,
  difficulty: DifficultyLevel = 'normal',
  isCatchingUp = false,
  withProgress = false,
): Promise<Question | QuestionWithProgress> {
  if ((mode === 'category' || mode === 'custom') && !category) {
    throw new Error(`Category must be provided when mode is "${mode}"`);
  }

  const payload: Record<string, string | boolean | DifficultyLevel> = {
    userId,
    mode,
    difficulty,
    isCatchingUp,
    withProgress,
  };
  if (customPrompt?.trim()) {
    payload.customPrompt = customPrompt.trim();
  }
  if (category) {
    payload.category = category;
    questionLogger.debug(`Adding category "${category}" to payload for ${mode} mode`);
  }

  try {
    if (withProgress) {
      const response = await apiService.request<QuestionWithProgress>('/generate-question', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      questionLogger.debug('Question with progress generated successfully');
      return response;
    } else {
      const response = await apiService.request<Question>('/generate-question', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      questionLogger.debug('Question generated successfully');
      return response;
    }
  } catch (error) {
    questionLogger.error('Failed to generate question', error);
    // Rethrow the error so the caller can handle it
    throw error;
  }
}

// ── Step Pipeline ──────────────────────────────────────────────────────────────

const stepLogger = createLogger('StepPipeline');

async function callStep1(params: Step1Request): Promise<Step1Response> {
  return apiService.request<Step1Response>('/question-gen/step1', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

async function callStep2(params: Step2Request): Promise<Step2Response> {
  return apiService.request<Step2Response>('/question-gen/step2', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

async function callStep3(params: Step3Request): Promise<Step3Response> {
  return apiService.request<Step3Response>('/question-gen/step3', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

const MAX_STEP_RETRIES = 3;

/**
 * Generate a question using the 3-step pipeline with real progress updates.
 *
 * Step 1: Generate question (AI pipeline)
 * Step 2: Check for duplicates (fuse.js topic + text matching)
 * Step 3: Fact-check (secondary AI validation)
 *
 * Retries from step 1 if step 2 finds duplicate or step 3 fails.
 */
export async function generateQuestionStepped(
  userId: string,
  mode: GenerateMode,
  category: string | undefined,
  difficulty: DifficultyLevel,
  isCatchingUp: boolean,
  onProgress: (progress: StepProgress) => void,
): Promise<Question> {
  let excludedTopics: string[] = [];

  for (let attempt = 1; attempt <= MAX_STEP_RETRIES; attempt++) {
    // Step 1: Generate
    const generateMessages = [
      'Asking Claude to craft a question...',
      'Cooking up something fresh with Sonnet & Haiku...',
      'Spinning up the AI trivia factory...',
    ];
    onProgress({
      step: 'generating',
      message: attempt > 1
        ? 'Rolling the dice on a new question...'
        : generateMessages[Math.floor(Math.random() * generateMessages.length)],
      attempt,
    });

    // 403 or eligibility errors propagate to the caller
    const step1 = await callStep1({
      userId,
      mode,
      category,
      difficulty,
      isCatchingUp,
      excludedTopics: excludedTopics.length > 0 ? excludedTopics : undefined,
    });

    // Show which model won
    const sourceLabel = step1.source === 'judge-enhanced' ? 'Best of Sonnet + Haiku'
      : step1.source === 'trivia-bank' ? 'Pulled from the trivia vault'
      : `Generated by ${step1.source === 'sonnet' ? 'Sonnet' : 'Haiku'}`;
    onProgress({
      step: 'checking-duplicates',
      message: `${sourceLabel} — scanning all past questions for repeats...`,
      attempt,
    });

    // Step 2: Check duplicates
    const step2 = await callStep2({
      userId,
      sessionId: step1.sessionId,
      question: step1.question,
    });

    if (step2.isDuplicate) {
      stepLogger.info('Duplicate detected, retrying', {
        attempt,
        matchMethod: step2.matchMethod,
        matchedTopics: step2.matchedTopics,
      });

      // Accumulate excluded topics for next attempt
      if (step2.matchedTopics?.length) {
        excludedTopics = [...excludedTopics, ...step2.matchedTopics];
      }

      const topicHint = step2.matchedTopics?.length
        ? ` (matched: ${step2.matchedTopics.slice(0, 2).join(', ')})`
        : '';
      onProgress({
        step: 'retrying',
        message: `Oops, that one's been asked before${topicHint} — trying again...`,
        attempt,
      });
      continue;
    }

    // Step 3: Fact-check
    onProgress({
      step: 'fact-checking',
      message: 'Getting a second AI opinion on the answer...',
      attempt,
    });

    const step3 = await callStep3({
      userId,
      sessionId: step1.sessionId,
      question: step2.question,
    });

    if (!step3.ready) {
      stepLogger.info('Fact-check failed, retrying', { attempt });
      onProgress({
        step: 'retrying',
        message: 'Hmm, the fact-checker wasn\'t convinced — regenerating...',
        attempt,
      });
      continue;
    }

    // Success
    onProgress({ step: 'complete', message: 'Question locked and loaded!' });
    return step3.question;
  }

  // All retries exhausted — fall back to single-call endpoint
  stepLogger.warn('Step pipeline exhausted retries, falling back to single-call');
  onProgress({
    step: 'generating',
    message: 'Almost there...',
  });

  const fallback = await generateQuestion(userId, mode, undefined, category, difficulty, isCatchingUp, true);
  const q = 'question' in fallback && 'messages' in fallback
    ? (fallback as QuestionWithProgress).question
    : fallback as Question;

  onProgress({ step: 'complete', message: 'Question ready!' });
  return q;
}

/**
 * Gets the catchup status for a user
 * This tells you how many questions they need to answer to be fully caught up
 */
export async function getCatchupStatus(userId: string): Promise<CatchupStatus> {
  return apiService.request<CatchupStatus>(`/catchup-status?userId=${encodeURIComponent(userId)}`, {
    method: 'GET',
  });
}

/**
 * Fetches the question generation status for a user
 */
export async function getQuestionStatus(userId: string): Promise<QuestionStatus> {
  questionLogger.debug(`Getting question status for user: ${userId}`);

  try {
    const result = await apiService.request<QuestionStatus>(
      `/question-status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
    );

    questionLogger.debug(`Received question status for ${userId}:`, result);
    return result;
  } catch (error) {
    questionLogger.error(`Failed to get question status for ${userId}:`, error);
    // Return a default response to prevent app from breaking
    return {
      lastQuestionAt: null,
      nextQuestionAt: new Date().toISOString(),
    };
  }
}

/**
 * Checks if a user can answer a question today
 * This is the authoritative source for question availability
 *
 * @param userId The user ID to check
 * @param forceRefresh If true, will invalidate cache and force a fresh API call
 */
export async function canAnswerQuestion(
  userId: string,
  forceRefresh = false,
): Promise<QuestionAvailability> {
  questionLogger.debug(`Checking question availability for user: ${userId}, forceRefresh: ${forceRefresh}`);

  // Generate a consistent cache key for this user
  const cacheKey = `can_answer_${userId}`;

  // Only invalidate cache if forced refresh is requested
  if (forceRefresh) {
    // Invalidate relevant caches
    cacheService.invalidatePattern(cacheKey);
    cacheService.invalidatePattern(`/can-answer-question?userId=${userId}`);
  }

  try {
    // Use 5-second cache for this call to avoid redundant, immediate calls
    const cacheDuration = 5000; // 5 seconds

    // The actual API request with caching
    const result = await apiService.request<QuestionAvailability>(
      `/can-answer-question?userId=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: forceRefresh ? { 'Cache-Control': 'no-cache' } : undefined,
        cacheKey: cacheKey,
        cacheDuration: cacheDuration,
      },
    );

    questionLogger.debug(`Received question availability for ${userId}:`, result);
    return result;
  } catch (error) {
    questionLogger.error(`Failed to get question availability for ${userId}:`, error);
    // Return a default response to prevent app from breaking
    return {
      canAnswer: true, // Default to allowing answers if we can't determine
      nextQuestionAt: new Date().toISOString(),
      todayET: new Date()
        .toLocaleString('en-US', {
          timeZone: 'America/New_York',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })
        .split(',')[0]
        .replace(/\//g, '-'),
    };
  }
}

// ── Answers ─────────────────────────────────────────────────────────────────

export interface SubmissionResult {
  correct: boolean;
  streak: number;
  pointsEarned?: number;
  multiplier?: number;
}

export async function submitAnswer(
  userId: string,
  groupId: string,
  question: Question,
  selectedAnswer: string,
  isCatchingUp = false,
  isCustomCategory?: boolean,
): Promise<SubmissionResult> {
  const today = new Date().toISOString().split('T')[0];
  cacheService.invalidate(`daily_question_${userId}_${today}`);
  cacheService.invalidate(`user_profile_${userId}`);
  cacheService.invalidate(`leaderboard_${groupId}`);
  cacheService.invalidate(`enhanced_leaderboard_${groupId}`);
  cacheService.invalidate(`group_leaderboard`);
  cacheService.invalidate(`can_answer_${userId}`);

  return apiService.request<SubmissionResult>('/submit-answer', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      groupId,
      question,
      selectedAnswer,
      isCatchingUp,
      isCustomCategory,
    }),
  });
}

// ── Categories ──────────────────────────────────────────────────────────────

/**
 * Get all available categories, including system defaults and user custom categories
 */
export async function getCategories(userId: string): Promise<CategoryResponse> {
  return apiService.request<CategoryResponse>(
    `/categories?userId=${encodeURIComponent(userId)}`,
    { method: 'GET' },
    `categories_${userId}`,
    false, // Use cache by default
  );
}

/**
 * Create a new custom category based on a user-provided topic
 */
export async function createCustomCategory(userId: string, topic: string): Promise<CustomCategory> {
  return apiService.request<CustomCategory>('/create-custom-category', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      topic,
    }),
  });
}

/**
 * Save a custom category to the user's profile
 */
export async function submitCustomCategory(
  userId: string,
  category: CustomCategory,
): Promise<{ success: boolean }> {
  return apiService.request<{ success: boolean }>('/submit-custom-category', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      category,
    }),
  });
}
