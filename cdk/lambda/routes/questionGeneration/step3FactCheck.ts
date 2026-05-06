// File: lambda/routes/questionGeneration/step3FactCheck.ts
// Purpose: Step 3 — Fact-check the question using a secondary AI validation.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../config';
import { logger } from '../../services/logger';
import { factCheckQuestion } from '../../services/bedrock/questions/factChecker';
import type { Step3Request, Step3Response } from '@family-trivia/shared';

const SKIP_CATEGORIES = ['personal', 'group', 'Fun Facts & Oddities'];

export async function step3FactCheck(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}') as Step3Request;
    const { userId, sessionId, question, skipFactCheck = false } = body;

    if (!userId || !sessionId || !question) {
      return errorResponse('Missing required parameters: userId, sessionId, and question', 400);
    }

    const startTime = Date.now();
    logger.info('Step3: fact-checking', { userId, sessionId, category: question.category });

    const shouldSkip =
      skipFactCheck ||
      (question.category && SKIP_CATEGORIES.includes(question.category));

    let factCheckResult;
    let isAccurate = true;

    if (!shouldSkip) {
      try {
        factCheckResult = await factCheckQuestion(question as any);
        isAccurate = factCheckResult.isAccurate;

        // If fact-check corrected the answer, apply it
        if (!isAccurate && factCheckResult.suggestedCorrection) {
          const corrected = factCheckResult.suggestedCorrection;
          if (question.choices.includes(corrected)) {
            question.answer = corrected;
            isAccurate = true; // Now it's accurate with the correction
            logger.info('Step3: answer corrected', { sessionId, corrected });
          }
        }

        logger.info('Step3: fact-check result', {
          sessionId,
          isAccurate,
          confidence: factCheckResult.confidence,
          checkedBy: factCheckResult.checkedBy,
        });
      } catch (err: any) {
        // Fact-check failure is non-fatal — proceed without it
        logger.warn('Step3: fact-check failed, proceeding', { error: err.message, sessionId });
      }
    } else {
      logger.info('Step3: skipping fact-check', { sessionId, category: question.category });
    }

    const response: Step3Response = {
      question,
      factCheckResult: factCheckResult ? {
        isAccurate: factCheckResult.isAccurate,
        confidence: factCheckResult.confidence === 'high' ? 1 : factCheckResult.confidence === 'medium' ? 0.7 : 0.4,
        explanation: factCheckResult.explanation,
        checkedBy: factCheckResult.checkedBy,
      } : undefined,
      sessionId,
      completedAt: Date.now(),
      ready: isAccurate,
    };

    logger.info('Step3 complete', {
      userId,
      sessionId,
      ready: isAccurate,
      duration: Date.now() - startTime,
    });

    return successResponse(response);
  } catch (error: any) {
    logger.error('Step3 error', { error: error.message, stack: error.stack });
    return errorResponse(error.message || 'Failed to fact-check question', 500);
  }
}
