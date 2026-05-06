// File: lambda/routes/submitAnswer.ts
// Purpose: Handle user answer to a trivia question—persist history, compute correctness & streak.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';
import { checkPlayEligibility } from '../services/playerStateService';
import { Question, HistoryEntry, PlayMode } from '@family-trivia/shared';
import { checkLeaderChange } from '../services/notificationService';

export async function submitAnswer(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Processing answer submission');
  
  try {
    // Parse request body
    const body = event.body || '{}';
    const { userId, groupId, question, selectedAnswer, isCatchingUp } = JSON.parse(body);
    
    logger.info('Answer submission details', { 
      userId, 
      groupId, 
      isCatchingUp: !!isCatchingUp 
    });
    
    if (!userId || !question || !selectedAnswer) {
      logger.warn('Missing required fields in submission', {
        hasUserId: !!userId,
        hasQuestion: !!question,
        hasSelectedAnswer: !!selectedAnswer
      });
      return errorResponse('Missing userId, question or selectedAnswer', 400);
    }
    
    // Server-side eligibility check — validate BOTH regular and catchup claims.
    // The client sends isCatchingUp; we must not trust it. If the client claims
    // catchup but has no gaps, reject. If they claim regular but already answered
    // today, reject. This is the only gate between client and persisted history.
    const mode: PlayMode = isCatchingUp ? 'catchup' : 'regular';
    const eligibility = await checkPlayEligibility(userId, mode);
    if (!eligibility.canPlay) {
      logger.warn(`Answer submission blocked for ${userId}: ${eligibility.reason}`, {
        claimedMode: mode,
      });
      const reason = (eligibility as any).reason;
      const message =
        reason === 'end_of_season' ? 'Season has ended' :
        reason === 'no_catchup_available' ? 'No catch-up questions available' :
        'Daily question limit reached';
      return errorResponse(
        message,
        403,
        JSON.stringify({
          reason,
          nextAvailableAt: (eligibility as any).nextAvailableAt,
          catchupAvailable: eligibility.catchupAvailable,
        }),
      );
    }

    // 1) Determine correctness
    const questionObj = question as Question;
    
    const correct = questionObj.answer === selectedAnswer;
    
    // Calculate points earned based on correctness and multiplier
    const pointMultiplier = questionObj.pointMultiplier || 1.0;
    const basePoints = correct ? 1 : 0;
    let pointsEarned = basePoints * pointMultiplier;

    // Apply category accuracy bonus (only for correct answers)
    let categoryBonus = 0;
    if (correct && questionObj.category) {
      try {
        const accuracyCache = await getJson<Record<string, { total: number; correct: number }>>(
          S3_PATHS.CATEGORY_ACCURACY_CACHE
        );
        const catStats = accuracyCache?.[questionObj.category];
        if (catStats && catStats.total >= 10) {
          const accuracy = catStats.correct / catStats.total;
          if (accuracy < 0.4) {
            categoryBonus = 2;
          } else if (accuracy < 0.6) {
            categoryBonus = 1;
          }
        }
      } catch {
        logger.debug('No category accuracy cache available for bonus calculation');
      }
      pointsEarned += categoryBonus;
    }
    
    logger.info('Answer evaluation', {
      userId,
      category: questionObj.category,
      difficulty: questionObj.difficulty || 'normal',
      correct,
      pointsEarned
    });

    // 2) Load existing history (or default to empty)
    const histKey = S3_PATHS.ANSWER_HISTORY(userId);
    
    let history: HistoryEntry[] = [];
    try {
      history = (await getJson<HistoryEntry[]>(histKey)) || [];
      logger.debug('Loaded user history', { userId, historyLength: history.length });
    } catch (error) {
      logger.info('No existing history found, using empty history', { userId });
      // Continue with empty history
    }

    // 3) Append this answer event

    // Frontend code will pass in whether this is a custom category
    // If not provided explicitly, determine based on the request data
    const requestData = JSON.parse(body);

    // Use the isCustomCategory from the request if provided
    // Otherwise fall back to checking mode and type
    const isCustomCategory =
        // First priority: explicitly passed flag
        requestData.isCustomCategory !== undefined ? requestData.isCustomCategory :
        // Second priority: mode or type markers
        (questionObj.mode && questionObj.mode === 'custom') ||
        (questionObj.type && questionObj.type === 'custom') ||
        // Default
        false;

    logger.debug('Category determination', {
      userId,
      category: questionObj.category,
      isCustomCategory
    });

    const entry: HistoryEntry = {
      question: questionObj,
      selectedAnswer,
      correct,
      timestamp: new Date().toISOString(),
      pointsEarned,
      isCatchingUp: !!isCatchingUp,
      isCustomCategory: !!isCustomCategory,
      ...(categoryBonus > 0 && { categoryBonus }),
    };
    history.push(entry);

    // 4) Persist updated history back to S3
    try {
      await putJson(histKey, history);
      logger.info('Saved answer to history', {
        userId,
        historyLength: history.length
      });

      // Mark user as activated on first answer (avoids N+1 reads in appInit)
      if (history.length === 1) {
        try {
          const activation = await getJson<Record<string, boolean>>(S3_PATHS.MEMBER_ACTIVATION) || {};
          if (!activation[userId]) {
            activation[userId] = true;
            await putJson(S3_PATHS.MEMBER_ACTIVATION, activation);
            logger.info('Updated member activation cache', { userId });
          }
        } catch (err) {
          logger.warn('Failed to update member activation cache', {
            userId, error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    } catch (error) {
      logger.error('Failed to save answer history', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // 5) Compute current streak (consecutive correct answers at end of history)
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].correct) {
        streak++;
      } else {
        break;
      }
    }

    logger.info('Answer submission complete', { 
      userId, 
      correct, 
      streak, 
      pointsEarned 
    });
    
    // 6) Check for leader change (fire-and-forget — don't block response)
    checkLeaderChange().catch(err =>
      logger.error('Leader change check failed', { error: err instanceof Error ? err.message : String(err) }),
    );

    // 7) Return result with points information
    return successResponse({
      correct,
      streak,
      pointsEarned,
      multiplier: pointMultiplier,
      ...(categoryBonus > 0 && { categoryBonus }),
    });
  } catch (error) {
    logger.error('Unhandled error in answer submission', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return errorResponse('Internal server error', 500);
  }
}
