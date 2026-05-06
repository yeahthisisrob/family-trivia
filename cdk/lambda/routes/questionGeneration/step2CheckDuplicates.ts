// File: lambda/routes/questionGeneration/step2CheckDuplicates.ts
// Purpose: Step 2 — Check for duplicate questions using fuse.js topic matching
// + 4-method text comparison against a wider history window (1000 questions).

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../../config';
import { logger } from '../../services/logger';
import { isDuplicateWithTopicCheck } from '../../services/bedrock/questions/utils';
import { getAllQuestionsFlat } from '../../services/questionHistoryService';
import { Question } from '../../services/bedrock/core/types';
import type { Step2Request, Step2Response, SimilarQuestion } from '@family-trivia/shared';

export async function step2CheckDuplicates(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}') as Step2Request;
    const { userId, sessionId, question } = body;

    if (!userId || !sessionId || !question) {
      return errorResponse('Missing required parameters: userId, sessionId, and question', 400);
    }

    const startTime = Date.now();
    logger.info('Step2: checking duplicates', { userId, sessionId });

    // Wider history window than pipeline's 500 — catches older repeats
    const recentQuestions = await getAllQuestionsFlat() as Question[];
    logger.info('Step2: loaded history', { count: recentQuestions.length });

    // Run combined topic + text dedup
    const result = isDuplicateWithTopicCheck(question as Question, recentQuestions);

    let similarQuestions: SimilarQuestion[] = [];
    if (result.isDuplicate) {
      logger.warn('Step2: DUPLICATE DETECTED', {
        generatedQuestion: question.question.substring(0, 80),
        matchMethod: result.matchMethod,
        details: result.details,
        sessionId,
      });

      // Find which questions triggered the match (up to 3)
      similarQuestions = recentQuestions
        .map(q => {
          const check = isDuplicateWithTopicCheck(question as Question, [q]);
          return check.isDuplicate
            ? { question: q.question, similarity: check.similarity ?? 0.9, matchMethod: check.matchMethod ?? 'unknown' }
            : null;
        })
        .filter((x): x is SimilarQuestion => x !== null)
        .slice(0, 3);
    }

    const response: Step2Response = {
      isDuplicate: result.isDuplicate,
      matchMethod: result.matchMethod,
      matchedTopics: result.details?.matchedTopics,
      similarQuestions: result.isDuplicate ? similarQuestions : undefined,
      sessionId,
      checkedAt: Date.now(),
      question, // Pass through for step3
    };

    logger.info('Step2 complete', {
      userId,
      sessionId,
      isDuplicate: result.isDuplicate,
      matchMethod: result.matchMethod,
      duration: Date.now() - startTime,
    });

    return successResponse(response);
  } catch (error: any) {
    logger.error('Step2 error', { error: error.message, stack: error.stack });
    return errorResponse(error.message || 'Failed to check duplicates', 500);
  }
}
