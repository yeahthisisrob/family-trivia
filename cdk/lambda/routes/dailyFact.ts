// File: lambda/routes/dailyFact.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson, listObjects, fileExists, putJsonIfNotExists } from '../services/s3';
import { generateFunFact, generateUniqueQuestion } from '../services/bedrock';
import { generateDailyFactQuestion, generateQuestionOptions, getTodaySharedQuestion, saveTodaySharedQuestion, FACT_CATEGORIES } from '../services/dailyFactService';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { isEndOfSeason } from '../utils/endOfSeason';
import { getEasternDateString, getWeekStartDateET, isNewWeekStartingET } from '@family-trivia/shared';
import {
  getFactHistory,
  hasAnsweredBasicQuestion,
  countCompletedBasicQuestions as countCompletedBasics,
  appendFactAnswer,
  getSharedAnswersByDate,
  invalidateFactHistoryCache,
} from '../services/factHistoryService';
import { FactAnswerEntry } from '@family-trivia/shared';
import { logger } from '../services/logger';

// Basic questions will be loaded from S3
let BASIC_QUESTIONS: string[] = []; // Will be populated from S3
const BASIC_QUESTIONS_S3_KEY = S3_PATHS.BASIC_QUESTIONS_CONFIG;

/**
 * Initialize basic questions by loading them from S3
 */
async function initializeBasicQuestions(): Promise<void> {
  try {
    logWithTime(`Loading basic questions from S3: ${BASIC_QUESTIONS_S3_KEY}`);

    if (await fileExists(BASIC_QUESTIONS_S3_KEY)) {
      const basicQuestionsConfig = await getJson<{
        version: string;
        lastUpdated: string;
        questions: string[];
      }>(BASIC_QUESTIONS_S3_KEY);

      if (basicQuestionsConfig &&
          basicQuestionsConfig.questions &&
          Array.isArray(basicQuestionsConfig.questions)) {

        BASIC_QUESTIONS = basicQuestionsConfig.questions;
        logWithTime(`Successfully loaded ${BASIC_QUESTIONS.length} basic questions from S3`);
        return;
      }
    }

    // If we reach here, no questions were found or there was an issue
    logWithTime(`No basic questions found in S3, using empty array`);
    BASIC_QUESTIONS = [];
  } catch (err) {
    logWithTime(`Error loading basic questions from S3:`, err);
    // Use empty array if there's an error
    BASIC_QUESTIONS = [];
  }
}

/**
 * Generates a key for storing basic question responses
 * Format: facts/daily/{userId}/basic_{index}_{date}.json
 */
function getBasicQuestionKey(userId: string, questionIndex: number, date?: string): string {
  const dateStr = date || getEasternDate();
  return S3_PATHS.BASIC_QUESTION(userId, questionIndex, dateStr);
}

/**
 * Generates a key for storing shared question responses
 * Format: facts/daily/{userId}/shared_{date}.json
 * Now uses daily dates instead of weekly
 */
function getSharedQuestionKey(userId: string, date?: string): string {
  const dateStr = date || getEasternDate();
  return S3_PATHS.SHARED_QUESTION(userId, dateStr);
}

// Helper: log with timestamp for better debugging
function logWithTime(message: string, data?: any): void {
  if (data) {
    logger.info(message, data);
  } else {
    logger.info(message);
  }
}

// Aliases for the consolidated timezone utils (preserving local call sites)
const getEasternDate = () => getEasternDateString();
const getCurrentWeekStart = () => getWeekStartDateET();
const isSunday = () => isNewWeekStartingET();

/**
 * Checks if a user has completed all basic questions.
 * Reads from consolidated fact history (single file per user).
 */
async function hasCompletedBasicQuestions(userId: string): Promise<boolean> {
  for (let i = 0; i < BASIC_QUESTIONS.length; i++) {
    if (!(await hasAnsweredBasicQuestion(userId, i))) return false;
  }
  return true;
}

/**
 * Counts the number of basic questions a user has completed.
 */
async function countCompletedBasicQuestions(userId: string): Promise<number> {
  return countCompletedBasics(userId);
}

/**
 * Returns the next unanswered basic question for a user.
 */
async function getNextBasicQuestion(userId: string): Promise<{
  question: string,
  questionType: 'basic' | 'shared',
  questionIndex: number,
  basicQuestionsTotal: number,
  basicQuestionsCompleted: number
}> {
  const completedCount = await countCompletedBasicQuestions(userId);

  for (let i = 0; i < BASIC_QUESTIONS.length; i++) {
    if (!(await hasAnsweredBasicQuestion(userId, i))) {
      return {
        question: BASIC_QUESTIONS[i],
        questionType: 'basic',
        questionIndex: i,
        basicQuestionsTotal: BASIC_QUESTIONS.length,
        basicQuestionsCompleted: completedCount,
      };
    }
  }

  throw new Error('No unanswered basic questions found');
}

/**
 * Gets or creates a shared daily question for all users
 * New questions are generated each day
 */
async function getOrCreateSharedQuestion(userTheme?: string, userId?: string, event?: any): Promise<{
  question: string,
  questionType: 'basic' | 'shared',
  isFirstPerson?: boolean,
  date: string,
  category?: string,
  createdBy?: string | null,
}> {
  const todayDate = getEasternDate();
  const sharedKey = S3_PATHS.GLOBAL_SHARED_QUESTION(todayDate);

  logWithTime(`Checking for daily shared question at key: ${sharedKey}`);

  // Always check if a shared question exists first
  const existingQuestion = await getJson<any>(sharedKey);
  if (existingQuestion && existingQuestion.question) {
    logWithTime(`Retrieved daily shared question: ${existingQuestion.question}`);
    return {
      question: existingQuestion.question,
      questionType: 'shared',
      isFirstPerson: false,
      date: todayDate
    };
  }

  // No shared question exists for today yet
  
  // Check if season has ended - don't allow creating new shared questions
  if (await isEndOfSeason()) {
    logWithTime(`Season has ended, not allowing new shared question creation`);
    return {
      question: 'Season has ended - no new questions available',
      questionType: 'shared',
      isFirstPerson: false,
      date: todayDate
    };
  }
  
  // If no theme is provided, this is the first person checking - don't generate yet
  if (!userTheme) {
    logWithTime(`No shared question exists for ${todayDate}, user is first person`);
    return {
      question: '', // Empty question indicates they need to create one
      questionType: 'shared',
      isFirstPerson: true,
      date: todayDate
    };
  }
  
  // User provided a theme, so generate the question
  logWithTime(`Processing shared question for ${todayDate} with theme/question: ${userTheme}`);

  try {
    let dailyQuestion;

    // Check if the "theme" is actually a full question (contains a question mark or is long enough)
    if (userTheme.includes('?') || userTheme.length > 50) {
      // This is the actual question selected by the user
      dailyQuestion = {
        question: userTheme,
        category: 'Custom',
        timestamp: new Date().toISOString(),
        date: todayDate,
        questionType: 'shared' as const,
        createdBy: userId || null,
        createdByFirstPerson: true,
        theme: userTheme,
      };
      logWithTime(`Using provided question directly: ${userTheme}`);
    } else {
      // Generate using the new service (checks ALL previous questions)
      const categoryId = (event as any)?.categoryId;
      dailyQuestion = await generateDailyFactQuestion(userId || 'unknown', userTheme, categoryId);
      logWithTime(`Generated new daily question: ${dailyQuestion.question}`);
    }

    // Create the shared question object with full metadata
    const sharedQuestion = {
      ...dailyQuestion,
      createdAt: new Date().toISOString(),
    };

    // Use conditional write to prevent race conditions
    const wasWritten = await putJsonIfNotExists(sharedKey, sharedQuestion);
    
    if (wasWritten) {
      logWithTime(`Successfully saved new daily shared question at ${sharedKey}`);
      return {
        question: dailyQuestion.question,
        questionType: 'shared',
        isFirstPerson: true,
        date: todayDate,
        category: dailyQuestion.category,
        createdBy: dailyQuestion.createdBy,
      };
    } else {
      // Another user beat us to it - fetch the question they created
      logWithTime(`Another user already created today's question, fetching it`);
      const racedQuestion = await getJson<any>(sharedKey);
      if (racedQuestion && racedQuestion.question) {
        return {
          question: racedQuestion.question,
          questionType: 'shared',
          isFirstPerson: false,
          date: todayDate
        };
      }
      
      // Fallback if we can't read the question
      throw new Error('Failed to read shared question after race condition');
    }
  } catch (err) {
    logWithTime(`Error in shared question creation:`, err);
    
    // Try one more time to read the question in case it was created
    const finalCheck = await getJson<any>(sharedKey);
    if (finalCheck && finalCheck.question) {
      return {
        question: finalCheck.question,
        questionType: 'shared',
        isFirstPerson: false,
        date: todayDate
      };
    }
    
    // Provide a fallback question in case of error
    return {
      question: "What's something interesting that happened to you today?",
      questionType: 'shared',
      isFirstPerson: true,
      date: todayDate
    };
  }
}

/**
 * Gets a daily fact question for a user, prioritizing basic questions then shared questions
 */
export async function getDailyFact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // For POST requests, get userId from body
  let userId: string | undefined;
  let catchup = false;
  let forceShared = false;
  let userTheme: string | undefined;
  let regenerate = false;
  
  if (event.httpMethod === 'POST' && event.body) {
    try {
      const body = JSON.parse(event.body);
      userId = body.userId;
      userTheme = body.theme;
      regenerate = body.regenerate === true;
      forceShared = true; // POST requests for themes are always for shared questions
    } catch (e) {
      logWithTime('Failed to parse request body', e);
    }
  } else {
    // GET request
    userId = event.queryStringParameters?.userId;
    catchup = event.queryStringParameters?.catchup === 'true';
    forceShared = event.queryStringParameters?.forceShared === 'true';
  }

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  // Check if season has ended and it's not a catch-up request
  if (!catchup && await isEndOfSeason()) {
    logWithTime(`Season has ended, blocking new daily facts for ${userId}`);
    return errorResponse('Season has ended', 403, 'The season has ended. Only catch-up facts are available.');
  }

  // Always initialize basic questions to get the latest from S3
  await initializeBasicQuestions();

  const eastToday = getEasternDate();

  try {
    // Handle regeneration separately to avoid race conditions
    if (regenerate && userTheme !== undefined) {
      const sharedKey = S3_PATHS.GLOBAL_SHARED_QUESTION(eastToday);
      logWithTime(`User ${userId} requesting regeneration of shared question for ${eastToday}`);
      
      // For regeneration, we need to be more careful
      // Only the first person who created the question should be able to regenerate
      const existingQuestion = await getJson<any>(sharedKey);
      if (existingQuestion && existingQuestion.question) {
        // Question already exists - don't allow regeneration
        logWithTime(`Shared question already exists, cannot regenerate`);
        
        // Return the existing question
        const userSharedKey = getSharedQuestionKey(userId, eastToday);
        let userAnswered = false;
        let userFact = undefined;
        
        if (await fileExists(userSharedKey)) {
          try {
            const userQuestion = await getJson<any>(userSharedKey);
            if (userQuestion.answered) {
              userAnswered = true;
              userFact = userQuestion.fact;
            }
          } catch (err) {
            logWithTime(`Error checking if user answered shared question:`, err);
          }
        }
        
        const completedCount = await countCompletedBasicQuestions(userId);
        
        return successResponse({
          question: existingQuestion.question,
          answered: userAnswered,
          questionType: 'shared',
          fact: userFact || existingQuestion.fact || undefined,
          isShared: true,
          isFirstPerson: false,
          date: eastToday,
          basicQuestionsTotal: BASIC_QUESTIONS.length,
          basicQuestionsCompleted: completedCount,
          regenerationBlocked: true,
          message: 'Question already exists for today'
        });
      }
    }
    
    // If forceShared is true, always return the shared question
    if (forceShared || userTheme !== undefined) {
      logWithTime(`Forcing shared question for user ${userId}${userTheme ? ' with theme: ' + userTheme : ''}`);
      const { question, questionType, isFirstPerson, date, category, createdBy } = await getOrCreateSharedQuestion(userTheme, userId, event);

      // Get the shared question to see if someone has answered it
      const sharedKey = S3_PATHS.GLOBAL_SHARED_QUESTION(date);
      const sharedQuestion = await getJson<any>(sharedKey);

      // Check if this specific user has answered it today
      const userSharedKey = getSharedQuestionKey(userId, date);
      let userAnswered = false;
      let userFact = undefined;

      if (await fileExists(userSharedKey)) {
        try {
          const userQuestion = await getJson<any>(userSharedKey);
          if (userQuestion.answered) {
            userAnswered = true;
            userFact = userQuestion.fact;
          }
        } catch (err) {
          logWithTime(`Error checking if user answered shared question:`, err);
        }
      }

      // Get the count of completed basic questions
      const completedCount = await countCompletedBasicQuestions(userId);

      return successResponse({
        question,
        answered: userAnswered,
        questionType,
        fact: userFact || sharedQuestion.fact || undefined,
        isShared: true,
        isFirstPerson,
        date,
        basicQuestionsTotal: BASIC_QUESTIONS.length,
        basicQuestionsCompleted: completedCount
      });
    }

    // Check basic question completion from consolidated history
    const completedBasics = await hasCompletedBasicQuestions(userId);
    const completedCount = await countCompletedBasicQuestions(userId);

    if (completedBasics) {
      // User completed basics — serve shared question
      // Check if user already answered today's shared question (from history)
      const sharedByDate = await getSharedAnswersByDate(userId);
      const todayAnswer = sharedByDate.get(eastToday);

      if (todayAnswer) {
        return successResponse({
          question: todayAnswer.question,
          answered: todayAnswer.answered,
          fact: todayAnswer.fact || undefined,
          questionType: 'shared',
          needsBasicCatchup: false,
          date: eastToday,
          basicQuestionsTotal: BASIC_QUESTIONS.length,
          basicQuestionsCompleted: completedCount,
        });
      }

      // No answer for today — check if shared question exists or user is first
      const { question, questionType, isFirstPerson, date } = await getOrCreateSharedQuestion(undefined, userId);

      if (isFirstPerson && !question) {
        return successResponse({
          question: '', answered: false, questionType: 'shared',
          needsBasicCatchup: false, isShared: true, isFirstPerson: true,
          date, basicQuestionsTotal: BASIC_QUESTIONS.length,
          basicQuestionsCompleted: completedCount,
        });
      }

      return successResponse({
        question, answered: false, questionType: 'shared',
        needsBasicCatchup: false, isShared: true, isFirstPerson, date,
        basicQuestionsTotal: BASIC_QUESTIONS.length,
        basicQuestionsCompleted: completedCount,
      });
    } else {
      // User hasn't completed basic questions — serve next basic
      const { question, questionType, questionIndex, basicQuestionsTotal, basicQuestionsCompleted } = await getNextBasicQuestion(userId);

      return successResponse({
        question, answered: false,
        questionType, needsBasicCatchup: true,
        catchupMode: catchup || undefined,
        questionIndex, basicQuestionsTotal, basicQuestionsCompleted,
      });
    }
  } catch (err) {
    logWithTime(`Error in getDailyFact:`, err);
    return errorResponse('Failed to get daily fact', 500);
  }
}

/**
 * Submits a daily fact answer and generates a fact response
 */
export async function submitDailyFact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, question, answer, skipped, catchupMode, questionIndex } = body as {
    userId: string;
    question: string;
    answer: string;
    skipped?: boolean;
    catchupMode?: boolean;
    questionIndex?: number;
  };

  // Allow empty question for first person skips
  if (!userId || (!question && question !== '') || !answer) {
    return errorResponse('Missing userId, question, or answer', 400);
  }
  
  // Check if season has ended and it's not a catch-up submission
  if (!catchupMode && await isEndOfSeason()) {
    logWithTime(`Season has ended, blocking new fact submission for ${userId}`);
    return errorResponse('Season has ended', 403, 'The season has ended. Only catch-up facts can be submitted.');
  }

  // Always initialize basic questions to get the latest from S3
  await initializeBasicQuestions();

  const eastToday = getEasternDate();

  // Determine question type + (for shared catchup) the original question date.
  // BUG FIX: previously only checked today's shared question, so catchup
  // answers to OLD shared questions were mis-typed as 'basic', which broke
  // the "answered dates" filter → same question re-prompted forever.
  let questionType = 'basic';
  let isSharedQuestion = false;
  let sharedQuestionDate: string | null = null;
  let resolvedQuestionIndex: number | undefined = questionIndex;

  // 1) Fast path: is this today's shared question?
  const todaySharedKey = S3_PATHS.GLOBAL_SHARED_QUESTION(eastToday);
  if (await fileExists(todaySharedKey)) {
    try {
      const sharedQuestion = await getJson<any>(todaySharedKey);
      if (sharedQuestion.question === question) {
        questionType = 'shared';
        isSharedQuestion = true;
        sharedQuestionDate = eastToday;
        logWithTime(`Identified question as today's shared question`);
      }
    } catch (err) {
      logWithTime(`Error checking if this is a shared question:`, err);
    }
  }

  // 2) If not today's shared, search all historical shared questions.
  //    This catches catchup answers to shared questions from previous days.
  if (!isSharedQuestion && question) {
    try {
      const sharedKeys = await listObjects(S3_PATHS.SHARED_QUESTIONS_DIR);
      for (const key of sharedKeys) {
        const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
        if (!dateMatch) continue;
        try {
          const sq = await getJson<any>(key);
          if (sq?.question === question) {
            questionType = 'shared';
            isSharedQuestion = true;
            sharedQuestionDate = dateMatch[1];
            logWithTime(`Identified as catchup shared question from ${sharedQuestionDate}`);
            break;
          }
        } catch { /* skip unreadable */ }
      }
    } catch (err) {
      logWithTime('Error scanning shared questions:', err);
    }
  }

  // 3) If still not shared, check if it's a basic question by text match
  //    (FactCatchup doesn't send questionIndex when answering basics from the queue).
  if (!isSharedQuestion && resolvedQuestionIndex === undefined && question) {
    await initializeBasicQuestions();
    const idx = BASIC_QUESTIONS.findIndex(q => q === question);
    if (idx >= 0) {
      resolvedQuestionIndex = idx;
      logWithTime(`Identified as basic question index ${idx} via text match`);
    }
  }

  // Server-side validation: block only on REAL prior answers.
  // Skipped entries are considered "accidental" and can be replaced
  // by a real answer (appendFactAnswer handles the replace).
  if (!skipped) {
    const sharedByDate = await getSharedAnswersByDate(userId);
    const isRealAnswer = (e: { answered: boolean; skipped?: boolean }) =>
      e.answered && !e.skipped;

    if (isSharedQuestion && sharedByDate.has(eastToday)) {
      const existing = sharedByDate.get(eastToday)!;
      if (isRealAnswer(existing)) {
        logWithTime(`User ${userId} already answered today's shared question`);
        return errorResponse('Already answered today\'s question', 403);
      }
    }
    if (!isSharedQuestion && resolvedQuestionIndex !== undefined) {
      // For basics, hasAnsweredBasicQuestion returns true for any answer
      // including skips. Check the full history for a REAL answer.
      const history = await getFactHistory(userId);
      const priorReal = history.find(e =>
        e.questionType === 'basic' &&
        e.questionIndex === resolvedQuestionIndex &&
        isRealAnswer(e),
      );
      if (priorReal && !catchupMode) {
        logWithTime(`User ${userId} already answered basic question ${resolvedQuestionIndex}`);
        return errorResponse('Already answered this question', 403);
      }
    }
    if (isSharedQuestion && sharedQuestionDate && sharedByDate.has(sharedQuestionDate)) {
      const existing = sharedByDate.get(sharedQuestionDate)!;
      if (isRealAnswer(existing)) {
        logWithTime(`User ${userId} already has a real answer for shared question dated ${sharedQuestionDate}`);
        return errorResponse('Already answered this question', 403);
      }
    }
  }

  // Check if this is a first person skip (empty question)
  const isFirstPersonSkip = !question || question === '';
  
  // If this is a skipped response
  if (skipped) {
    logWithTime(`User ${userId} skipped question: ${question || 'first person creation'}`);
    
    // For first person skip, don't save anything - just return
    if (isFirstPersonSkip) {
      logWithTime(`First person skipped question creation - not saving anything`);
      return successResponse({
        success: true,
        fact: "No problem! You can create a question next time.",
        isFirstPersonSkip: true
      });
    }
    
    // For regular questions, save the skip to consolidated history
    const skipResponse = isSharedQuestion ?
      "No worries! Check back tomorrow for a new question!" :
      "We'll ask you something else next time!";

    const skipEntry: FactAnswerEntry = {
      // For shared catchup skips, use the ORIGINAL question date so the
      // filter in FactCatchup correctly dedups against it.
      date: sharedQuestionDate ?? eastToday, question,
      answer: '[Skipped]', fact: skipResponse,
      answered: true, skipped: true,
      timestamp: new Date().toISOString(),
      questionType: questionType as 'shared' | 'basic',
      ...(questionType === 'basic' && resolvedQuestionIndex !== undefined && { questionIndex: resolvedQuestionIndex }),
    };
    await appendFactAnswer(userId, skipEntry);
    invalidateFactHistoryCache(userId);

    const completedBasics = await hasCompletedBasicQuestions(userId);
    const completedCount = await countCompletedBasicQuestions(userId);

    return successResponse({
      success: true, fact: skipResponse,
      needsBasicCatchup: !completedBasics,
      basicQuestionsTotal: BASIC_QUESTIONS.length,
      basicQuestionsCompleted: completedCount,
    });
  }

  // Check if this is a first person trying to submit without creating a question
  if (isFirstPersonSkip) {
    logWithTime(`First person tried to submit answer without creating question`);
    return errorResponse('No question to answer yet', 400, 'Please create a question first');
  }

  try {
    // Generate AI fact response
    const factResponse = await generateFunFact(userId, question, answer);
    const now = new Date().toISOString();

    // Append to consolidated fact history (single source of truth).
    // For shared catchup, entry.date = ORIGINAL question date (for dedup).
    const entry: FactAnswerEntry = {
      date: sharedQuestionDate ?? eastToday,
      question, answer,
      fact: factResponse,
      answered: true, skipped: false,
      timestamp: now,
      questionType: questionType as 'shared' | 'basic',
      ...(questionType === 'basic' && resolvedQuestionIndex !== undefined && { questionIndex: resolvedQuestionIndex }),
    };
    await appendFactAnswer(userId, entry);
    invalidateFactHistoryCache(userId);

    // If shared question, update global with first responder's fact
    // (only for today's shared question, not catchup)
    if (questionType === 'shared' && sharedQuestionDate === eastToday) {
      try {
        if (await fileExists(todaySharedKey)) {
          const sharedQuestion = await getJson<any>(todaySharedKey);
          if (!sharedQuestion.fact || !sharedQuestion.answered) {
            sharedQuestion.fact = factResponse;
            sharedQuestion.answered = true;
            sharedQuestion.answeredBy = userId;
            await putJson(todaySharedKey, sharedQuestion);
          }
        }
      } catch (err) {
        logWithTime(`Error updating shared question fact:`, err);
      }
    }

    const completedBasics = await hasCompletedBasicQuestions(userId);
    const completedCount = await countCompletedBasicQuestions(userId);

    return successResponse({
      success: true, fact: factResponse,
      needsBasicCatchup: !completedBasics,
      basicQuestionsTotal: BASIC_QUESTIONS.length,
      basicQuestionsCompleted: completedCount,
    });
  } catch (err) {
    logWithTime(`Error in submitDailyFact:`, err);
    const fallback = `That's a great answer! Thanks for sharing that with us.`;

    // Still save to history even on AI error
    const entry: FactAnswerEntry = {
      date: eastToday, question, answer,
      fact: fallback, answered: true, skipped: false,
      timestamp: new Date().toISOString(),
      questionType: questionType as 'shared' | 'basic',
      ...(questionType === 'basic' && questionIndex !== undefined && { questionIndex }),
    };
    await appendFactAnswer(userId, entry);
    invalidateFactHistoryCache(userId);

    const completedBasics = await hasCompletedBasicQuestions(userId);
    const completedCount = await countCompletedBasicQuestions(userId);

    return successResponse({
      success: true, fact: fallback,
      needsBasicCatchup: !completedBasics,
      basicQuestionsTotal: BASIC_QUESTIONS.length,
      basicQuestionsCompleted: completedCount,
    });
  }
}

/**
 * Get the last N shared questions
 */
export async function getRecentSharedQuestions(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const limit = parseInt(event.queryStringParameters?.limit || '6');
  
  try {
    // Get all shared question keys
    const sharedKeys = await listObjects(S3_PATHS.SHARED_QUESTIONS_DIR);
    
    // Sort by date (keys are in format shared/YYYY-MM-DD.json)
    const sortedKeys = sharedKeys
      .filter(key => key.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // Reverse chronological order
    
    // Get the most recent N questions
    const recentKeys = sortedKeys.slice(0, limit);
    const questions = [];
    
    for (const key of recentKeys) {
      try {
        const data = await getJson<any>(key);
        if (data?.question) {
          // Extract date from key (e.g., "facts/daily/shared/2024-01-15.json" -> "2024-01-15")
          const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
          const date = dateMatch ? dateMatch[1] : undefined;
          
          questions.push({
            question: data.question,
            date: date || data.date,
            timestamp: data.timestamp || data.createdAt,
            theme: data.theme,
            answeredCount: data.answeredCount || 0
          });
        }
      } catch (err) {
        logWithTime(`Error reading shared question ${key}:`, err);
      }
    }
    
    return successResponse({ questions });
  } catch (err) {
    logWithTime(`Error getting recent shared questions:`, err);
    return errorResponse('Failed to get recent questions', 500);
  }
}

/**
 * Get all historical daily facts for a user
 * Includes both basic and shared questions with their answers and facts
 */
export async function getUserFactHistory(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  const includeGlobal = event.queryStringParameters?.includeGlobal === 'true';

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  await initializeBasicQuestions();

  try {
    // Read from consolidated fact history (single file per user)
    const entries = await getFactHistory(userId);

    // Map to the FactHistoryItem shape the frontend expects
    const history = entries.map(e => ({
      question: e.question,
      answer: e.answer,
      fact: e.fact,
      timestamp: e.timestamp,
      answered: e.answered,
      skipped: e.skipped,
      questionType: e.questionType,
      questionIndex: e.questionIndex,
      date: e.date,
    }));

    // Sort by date descending
    history.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // If includeGlobal, load shared question definitions (these are just question texts + dates)
    let allSharedQuestions: any[] = [];
    if (includeGlobal) {
      const sharedKeys = await listObjects(S3_PATHS.SHARED_QUESTIONS_DIR);
      for (const key of sharedKeys) {
        try {
          const data = await getJson<any>(key);
          if (data?.question) {
            const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
            allSharedQuestions.push({
              question: data.question,
              date: dateMatch?.[1] || data.date,
              timestamp: data.timestamp || data.createdAt,
              theme: data.theme,
              questionType: 'shared',
              isGlobal: true,
            });
          }
        } catch { /* skip unreadable files */ }
      }
      allSharedQuestions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }

    return successResponse({
      history,
      basicQuestions: BASIC_QUESTIONS,
      basicQuestionsTotal: BASIC_QUESTIONS.length,
      allSharedQuestions,
    });
  } catch (err) {
    logWithTime(`Error getting user fact history:`, err);
    return errorResponse('Failed to get fact history', 500);
  }
}

/**
 * Submit or update a historical daily fact answer
 * This allows users to answer questions from the past or update their answers
 */
export async function submitHistoricalFact(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { 
    userId, 
    question, 
    answer, 
    date,
    questionType,
    questionIndex,
    skipped 
  } = body as {
    userId: string;
    question: string;
    answer: string;
    date: string;
    questionType: 'basic' | 'shared';
    questionIndex?: number;
    skipped?: boolean;
  };

  if (!userId || !question || !date) {
    return errorResponse('Missing required fields', 400);
  }

  try {
    if (skipped) {
      const skipResponse = questionType === 'shared'
        ? "You skipped this question."
        : "You skipped this basic question.";

      await appendFactAnswer(userId, {
        date, question, answer: '[Skipped]', fact: skipResponse,
        answered: true, skipped: true,
        timestamp: new Date().toISOString(),
        questionType, questionIndex,
      });
      invalidateFactHistoryCache(userId);

      return successResponse({ success: true, fact: skipResponse });
    }

    const factResponse = await generateFunFact(userId, question, answer);

    await appendFactAnswer(userId, {
      date, question, answer, fact: factResponse,
      answered: true, skipped: false,
      timestamp: new Date().toISOString(),
      questionType, questionIndex,
    });
    invalidateFactHistoryCache(userId);

    return successResponse({ success: true, fact: factResponse });
  } catch (err) {
    logWithTime(`Error submitting historical fact:`, err);
    return successResponse({ success: true, fact: 'Thanks for sharing your answer!' });
  }
}

/**
 * GET /daily-fact-categories — returns available categories for the first-person flow
 */
export async function getDailyFactCategories(
  _event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  return successResponse({ categories: FACT_CATEGORIES.map(c => ({ id: c.id, label: c.label, emoji: c.emoji, hint: c.hint })) });
}

/**
 * POST /daily-fact-options — generates 3 question options for a category
 */
export async function getDailyFactOptions(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, categoryId, theme } = body;

  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const options = await generateQuestionOptions(userId, theme);
    return successResponse({ options });
  } catch (err) {
    logWithTime('Error generating question options:', err);
    return errorResponse('Failed to generate options', 500);
  }
}