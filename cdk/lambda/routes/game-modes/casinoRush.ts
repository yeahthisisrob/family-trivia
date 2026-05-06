// File: lambda/routes/casinoRush.ts
// Purpose: Handle Casino Rush game mode - triple or nothing with timer

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson, deleteObject } from '../../services/s3';
import { successResponse, errorResponse, FEATURE_FLAGS } from '../../config';
import { DifficultyLevel, ProgressMessage } from '../../services/bedrock';
import { S3_PATHS } from '../../constants';
import { logger } from '../../services/logger';
import { canPlayGameMode } from '../../services/gameModeService';
import { getAvailableCategories } from './shared';
import { HistoryEntry, PlayMode } from '@family-trivia/shared';
import {
  generateQuestionWithOptions,
  validateGeneratedQuestion,
  GenerateQuestionRequest
} from '../questionGeneration/shared';

interface CasinoRushSession {
  userId: string;
  startTime: number;
  questions: Array<{
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: DifficultyLevel;
    startedAt?: number;       // When this question was first presented
    answeredAt?: number;
    userAnswer?: string;
    correct?: boolean;
  }>;
  currentQuestionIndex: number;
  difficulty: DifficultyLevel;
  status: 'active' | 'completed' | 'failed';
  potentialPoints: number;
  lastPlayedAt?: number;
  isCatchingUp?: boolean;
  progressMessages?: ProgressMessage[]; // Store progress messages from first question generation
}

// Server-side timeout is generous (90s) because the client enforces 60s.
// The extra 30s covers network latency + clock skew so legitimate
// answers aren't rejected on the server side.
const QUESTION_TIME_LIMIT = 90000;
const TOTAL_QUESTIONS = 3;
// Cooldown lives in shared/game-modes.ts (weekly); read via getGameModeCooldown
const CASINO_RUSH_SESSION_KEY = (userId: string) =>
  `casino-rush/${userId}/current-session.json`;

/**
 * When a casino rush game ends, write answered questions to the user's
 * regular answer history (same as regular trivia) and clean up session files.
 * This is the single source of truth — no more archived session files.
 */
async function finalizeSession(session: CasinoRushSession): Promise<void> {
  const { userId } = session;
  const isCompleted = session.status === 'completed';
  const allCorrect = session.questions.every(q => q.correct === true);
  const totalPoints = isCompleted && allCorrect && session.potentialPoints ? session.potentialPoints : 0;
  const pointsPerQ = totalPoints > 0 ? totalPoints / session.questions.length : 0;
  const sessionId = `cr_${session.startTime}`;

  // Load existing answer history
  const historyKey = S3_PATHS.ANSWER_HISTORY(userId);
  const history = (await getJson<HistoryEntry[]>(historyKey)) || [];

  // Append each answered question
  for (const q of session.questions) {
    if (!q.answeredAt) continue;
    history.push({
      question: {
        question: q.question,
        choices: q.choices,
        answer: q.answer,
        category: q.category,
        difficulty: q.difficulty,
      },
      selectedAnswer: q.userAnswer || 'Time Expired',
      correct: !!q.correct,
      timestamp: new Date(q.answeredAt).toISOString(),
      pointsEarned: q.correct && isCompleted && allCorrect ? pointsPerQ : 0,
      isCasinoRush: true,
      ...(session.isCatchingUp && { isCatchingUp: true }),
      casinoSessionId: sessionId,
    });
  }

  await putJson(historyKey, history);

  // Clean up session file — it was just scratch space
  try { await deleteObject(CASINO_RUSH_SESSION_KEY(userId)); } catch { /* ok */ }

  logger.info('Casino rush results written to answer history', {
    userId, sessionId, status: session.status, entriesAdded: session.questions.filter(q => q.answeredAt).length,
  });
}

async function canPlayCasinoRush(
  userId: string,
  playMode: PlayMode = 'casino-rush',
): Promise<{ canPlay: boolean; nextAvailable?: Date; hasActiveSession?: boolean; blockedReason?: string }> {
  // Block if there's an active session in flight
  try {
    const currentSession = await getJson<CasinoRushSession>(CASINO_RUSH_SESSION_KEY(userId));
    if (currentSession && currentSession.status === 'active') {
      return { canPlay: false, hasActiveSession: true, blockedReason: 'active_session' };
    }
  } catch { /* no session, continue */ }

  // Weekly cooldown + eligibility for the given PlayMode.
  const { canPlay, nextAvailable, blockedReason } = await canPlayGameMode(userId, 'casino-rush', playMode);
  return { canPlay, ...(nextAvailable && { nextAvailable }), ...(blockedReason && { blockedReason }) };
}

async function getOrCreateSession(userId: string, difficulty: DifficultyLevel): Promise<CasinoRushSession> {
  // Try to get existing current session
  try {
    const existingSession = await getJson<CasinoRushSession>(CASINO_RUSH_SESSION_KEY(userId));
    if (existingSession && existingSession.status === 'active') {
      return existingSession;
    }
  } catch (error) {
    // No existing session, create new one
  }

  // Return an in-memory session — DO NOT persist to S3 yet.
  // The session is only written after questions are successfully
  // generated. This prevents the "empty active session" bug where
  // question generation fails but the session is already on disk,
  // permanently locking the user out.
  const now = Date.now();
  return {
    userId,
    startTime: now,
    questions: [],
    currentQuestionIndex: 0,
    difficulty,
    status: 'active',
    potentialPoints: calculatePotentialPoints(difficulty),
    lastPlayedAt: now,
  };
}

function calculatePotentialPoints(difficulty: DifficultyLevel): number {
  const basePoints = {
    easy: 0.5,
    normal: 1,
    hard: 2
  };
  // Total points = basePoints * TOTAL_QUESTIONS (no extra multiplier)
  // For easy: 0.5 * 3 = 1.5 total
  // For normal: 1 * 3 = 3 total  
  // For hard: 2 * 3 = 6 total
  return basePoints[difficulty] * TOTAL_QUESTIONS;
}

export async function casinoRushStartGame(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Check feature flag first
  if (!FEATURE_FLAGS.CASINO_RUSH_ENABLED) {
    return errorResponse('Feature disabled', 503, 'Casino Rush is temporarily disabled');
  }
  
  const body = JSON.parse(event.body || '{}');
  const { userId, difficulty = 'normal', withProgress = false, isCatchingUp = false } = body;
  
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  if (!['easy', 'normal', 'hard'].includes(difficulty)) {
    return errorResponse('Invalid difficulty', 400);
  }
  
  try {
    // First check if there's an existing active session
    const existingSession = await getJson<CasinoRushSession>(CASINO_RUSH_SESSION_KEY(userId));
    if (existingSession && existingSession.status === 'active') {
      // Resume the existing session
      const session = existingSession;
      
      // Ensure we have a valid current question
      const currentQuestion = session.questions[session.currentQuestionIndex];
      if (!currentQuestion) {
        logger.error('No current question found in session', {
          session,
          index: session.currentQuestionIndex
        });
        return errorResponse('Invalid session state', 500);
      }

      // Include progress messages if available and this is the first question
      const includeMessages = session.currentQuestionIndex === 0 && session.progressMessages;
      
      // Reset startedAt for the current question so timer restarts on resume
      currentQuestion.startedAt = Date.now();
      await putJson(CASINO_RUSH_SESSION_KEY(userId), session);

      return successResponse({
        session: {
          currentQuestion: {
            ...currentQuestion,
            questionNumber: session.currentQuestionIndex + 1,
            totalQuestions: TOTAL_QUESTIONS,
            timeLimit: QUESTION_TIME_LIMIT
          },
          difficulty: session.difficulty,
          potentialPoints: session.potentialPoints,
          resumed: true,
          ...(includeMessages && { messages: session.progressMessages })
        }
      });
    }
  } catch (error) {
    // No existing session, continue to create new one
    logger.info('No existing session found, will create new one', { userId });
  }
  
  // Unified check: daily limit (catchup bypass) + weekly cooldown + active session.
  const { canPlay, nextAvailable, hasActiveSession, blockedReason } =
    await canPlayCasinoRush(userId, isCatchingUp ? 'catchup' : 'casino-rush');
  if (!canPlay) {
    const msg =
      hasActiveSession ? 'Resume your active Casino Rush' :
      blockedReason === 'end_of_season' ? 'Season has ended' :
      blockedReason === 'no_catchup_available' ? 'No catch-up available' :
      blockedReason === 'daily_limit_reached' ? 'Daily question limit reached' :
      'Casino Rush is on cooldown';
    logger.warn(`Casino Rush blocked for ${userId}: ${blockedReason}`);
    return errorResponse(msg, 403, nextAvailable?.toISOString(), blockedReason || 'COOLDOWN');
  }
  
  try {
    // Create new session
    const session = await getOrCreateSession(userId, difficulty);
    session.isCatchingUp = isCatchingUp;

    // Generate all questions if needed
    if (session.questions.length === 0) {
      try {
        // Get all available categories using shared function
        const allCategories = await getAvailableCategories(userId);
        
        // Ensure we have at least one category
        if (allCategories.length === 0) {
          logger.error('No categories found for question generation', { userId });
          return errorResponse('Failed to generate questions - No categories available', 500, 'No trivia categories were found in the system');
        }
        
        logger.info('Generating Casino Rush questions sequentially', { 
          userId, 
          difficulty,
          totalQuestions: TOTAL_QUESTIONS,
          categoriesAvailable: allCategories.length
        });
        
        let messages: ProgressMessage[] = [];
        
        // Initial progress message
        messages.push({
          type: 'info',
          message: `🎰 Starting Casino Rush! Preparing ${TOTAL_QUESTIONS} challenging questions...`,
          timestamp: Date.now()
        });
        
        // Generate each question sequentially
        for (let i = 0; i < TOTAL_QUESTIONS; i++) {
          const randomCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
          
          try {
            // Progress message for this question
            messages.push({
              type: 'info',
              message: `🎲 Question ${i + 1} of ${TOTAL_QUESTIONS}: Generating ${randomCategory} question...`,
              timestamp: Date.now()
            });
            
            logger.info(`Generating Casino Rush question ${i + 1}`, {
              userId,
              category: randomCategory,
              difficulty
            });
            
            // Generate the question using shared module
            const request: GenerateQuestionRequest = {
              userId,
              mode: 'category',
              category: randomCategory,
              difficulty,
              withProgress: i === 0 && withProgress, // Only first question gets full progress
              skipDailyCheck: true, // Casino Rush generates multiple questions
              questionNumber: i + 1,
              totalQuestions: TOTAL_QUESTIONS
            };
            
            const result = await generateQuestionWithOptions(request);
            const question = result.question;
            
            // Add progress messages
            if (result.messages) {
              messages.push(...result.messages);
            }
            
            // Validate the generated question
            if (!validateGeneratedQuestion(question)) {
              messages.push({
                type: 'warning',
                message: `⚠️ Question ${i + 1} needs to be regenerated...`,
                timestamp: Date.now()
              });
              
              logger.error(`Invalid question ${i + 1} generated`, { 
                userId, 
                category: randomCategory
              });
              
              return errorResponse(`Failed to generate question ${i + 1}`, 500, 'Invalid question format returned from the AI service');
            }

            session.questions.push({
              ...question,
              category: randomCategory,
              difficulty,
              // startedAt is NOT set here — it's set when the player
              // actually sees the question (on first answer/view call).
            });

          } catch (error) {
            logger.error(`Error generating question ${i + 1}`, {
              userId,
              category: randomCategory,
              error: error instanceof Error ? error.message : 'Unknown error'
            });

            return errorResponse(`Failed to generate question ${i + 1}`, 500, error instanceof Error ? error.message : 'Error occurred during question generation');
          }
        }
        
        // Final success message
        messages.push({
          type: 'success',
          message: `🎉 All ${TOTAL_QUESTIONS} questions ready! Good luck - win or lose it all!`,
          timestamp: Date.now()
        });
        
        logger.info('All Casino Rush questions generated successfully', {
          userId,
          sessionQuestionsCount: session.questions.length
        });
        
        // Store progress messages if available
        if (messages.length > 0) {
          session.progressMessages = messages;
        }
        
        // Don't set startedAt here — it's set when the frontend
        // confirms the player can see the question (via the answer
        // endpoint or a resume call).
        
        logger.info('Saving session with generated questions', {
          userId,
          questionCount: session.questions.length,
          sessionKey: CASINO_RUSH_SESSION_KEY(userId)
        });
        
        await putJson(CASINO_RUSH_SESSION_KEY(userId), session);
        
        logger.info('Session saved successfully', {
          userId,
          questionCount: session.questions.length
        });
      } catch (error) {
        const questionError = error as Error;
        logger.error('Error in Casino Rush question generation', {
          userId,
          error: questionError.message || String(error),
          stack: questionError.stack
        });
        // No cleanup needed — session was never written to S3.
        return errorResponse('Failed to generate Casino Rush questions', 500, questionError.message || 'Error occurred during question generation');
      }
    }
    
    // Ensure we have a valid current question
    const currentQuestion = session.questions[session.currentQuestionIndex];
    if (!currentQuestion) {
      logger.error('No current question found in session', {
        session,
        index: session.currentQuestionIndex
      });
      return errorResponse('Invalid session state', 500);
    }

    // Set startedAt NOW — the response is about to be sent to the player,
    // so the clock starts when they actually see the question.
    currentQuestion.startedAt = Date.now();
    await putJson(CASINO_RUSH_SESSION_KEY(userId), session);

    // Include progress messages if available and this is the first question
    const includeMessages = session.currentQuestionIndex === 0 && session.progressMessages;

    return successResponse({
      session: {
        currentQuestion: {
          ...currentQuestion,
          questionNumber: session.currentQuestionIndex + 1,
          totalQuestions: TOTAL_QUESTIONS,
          timeLimit: QUESTION_TIME_LIMIT
        },
        difficulty: session.difficulty,
        potentialPoints: session.potentialPoints,
        ...(includeMessages && { messages: session.progressMessages })
      }
    });
  } catch (error: any) {
    logger.error('Error starting Casino Rush', {
      userId,
      difficulty,
      error: error.message,
      errorType: error.name,
      stack: error.stack
    });
    
    // Provide more detailed error information to help with debugging
    return errorResponse(
      'Failed to start Casino Rush',
      500,
      error.message || 'Unknown error occurred',
      error.name || 'Error',
    );
  }
}

export async function casinoRushSubmitAnswer(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, answer } = body;
  
  if (!userId || answer === null || answer === undefined) {
    return errorResponse('Missing userId or answer', 400);
  }
  
  try {
    // Get current session
    const session = await getJson<CasinoRushSession>(CASINO_RUSH_SESSION_KEY(userId));
    if (!session || session.status !== 'active') {
      return errorResponse('No active Casino Rush session', 400);
    }
    
    const currentQuestion = session.questions[session.currentQuestionIndex];
    if (!currentQuestion) {
      return errorResponse('Invalid question index', 400);
    }
    
    const now = Date.now();

    // Set startedAt on first interaction with this question — meaning
    // the player has it on screen. This prevents the timer from
    // counting generation time.
    if (!currentQuestion.startedAt) {
      currentQuestion.startedAt = now;
      await putJson(CASINO_RUSH_SESSION_KEY(userId), session);
    }

    // Check time limit or empty answer (frontend timeout signal)
    const questionStartTime = currentQuestion.startedAt;
    const timeTaken = now - questionStartTime;
    
    if (timeTaken > QUESTION_TIME_LIMIT || answer === '') {
      currentQuestion.userAnswer = 'Time Expired';
      currentQuestion.correct = false;
      currentQuestion.answeredAt = now;
      session.status = 'failed';

      await finalizeSession(session);

      return successResponse({
        correct: false,
        reason: 'time_expired',
        earnedPoints: 0,
        gameOver: true
      });
    }

    // Check answer
    const correct = answer === currentQuestion.answer;
    currentQuestion.userAnswer = answer;
    currentQuestion.correct = correct;
    currentQuestion.answeredAt = now;

    if (!correct) {
      session.status = 'failed';
      await finalizeSession(session);

      return successResponse({
        correct: false,
        reason: 'wrong_answer',
        correctAnswer: currentQuestion.answer,
        earnedPoints: 0,
        gameOver: true
      });
    }

    // Correct answer - continue or complete
    session.currentQuestionIndex++;

    if (session.currentQuestionIndex >= TOTAL_QUESTIONS) {
      session.status = 'completed';
      await finalizeSession(session);

      return successResponse({
        correct: true,
        earnedPoints: session.potentialPoints,
        gameOver: true,
        complete: true,
        message: `Congratulations! You won ${session.potentialPoints} points!`
      });
    }
    
    // Get next question from pre-generated questions
    const nextQuestion = session.questions[session.currentQuestionIndex];
    if (!nextQuestion) {
      logger.error('No next question found in session', {
        userId,
        currentIndex: session.currentQuestionIndex,
        totalQuestions: session.questions.length
      });
      return errorResponse('Invalid session state - no next question available', 500);
    }
    
    // Set the start time for the next question
    nextQuestion.startedAt = Date.now();
    await putJson(CASINO_RUSH_SESSION_KEY(userId), session);
    
    return successResponse({
      correct: true,
      nextQuestion: {
        question: nextQuestion.question,
        choices: nextQuestion.choices,
        answer: nextQuestion.answer,
        category: nextQuestion.category,
        difficulty: nextQuestion.difficulty,
        questionNumber: session.currentQuestionIndex + 1,
        totalQuestions: TOTAL_QUESTIONS,
        timeLimit: QUESTION_TIME_LIMIT
      }
    });
  } catch (error: any) {
    logger.error('Error submitting Casino Rush answer', {
      userId,
      answer,
      error: error.message,
      errorType: error.name,
      stack: error.stack
    });
    return errorResponse('Failed to submit Casino Rush answer', 500, error.message || 'Unknown error occurred');
  }
}

export async function casinoRushStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Check feature flag first
  if (!FEATURE_FLAGS.CASINO_RUSH_ENABLED) {
    return successResponse({
      canPlay: false,
      reason: 'feature_disabled',
      message: 'Casino Rush is temporarily disabled'
    });
  }
  
  logger.info('Casino Rush status request', {
    path: event.path,
    httpMethod: event.httpMethod,
    queryStringParameters: event.queryStringParameters,
  });
  
  const userId = event.queryStringParameters?.userId;
  
  if (!userId) {
    logger.warn('Missing userId in casinoRushStatus request');
    return errorResponse('Missing userId', 400);
  }
  
  try {
    const { canPlay, nextAvailable } = await canPlayCasinoRush(userId);
    let activeSession;
    
    try {
      const session = await getJson<CasinoRushSession>(CASINO_RUSH_SESSION_KEY(userId));
      if (session?.status === 'active') {
        activeSession = {
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: TOTAL_QUESTIONS,
          difficulty: session.difficulty,
          potentialPoints: session.potentialPoints
        };
      }
    } catch (sessionError) {
      // If there's an error getting the session, just leave activeSession undefined
      logger.info('No active casino session found for user', { userId });
    }
    
    // Return response object with activeSession only if it exists
    const responseData: any = { canPlay, nextAvailable };
    if (activeSession) {
      responseData.activeSession = activeSession;
    }
    
    logger.info('Casino Rush status response', { 
      userId, 
      canPlay: responseData.canPlay,
      hasActiveSession: !!responseData.activeSession
    });
    return successResponse(responseData);
  } catch (error: any) {
    logger.error('Error getting Casino Rush status', {
      userId,
      error: error.message,
      errorType: error.name,
      stack: error.stack
    });
    return errorResponse('Failed to get Casino Rush status', 500, error.message || 'Unknown error occurred');
  }
}