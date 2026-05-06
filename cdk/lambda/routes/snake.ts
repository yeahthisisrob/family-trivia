// File: lambda/routes/snake.ts
// Purpose: Provide short-answer trivia questions for the Snake arcade game.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getAllQuestionsFlat } from '../services/questionHistoryService';
import { getAllFactHistories } from '../services/factHistoryService';
import { getJson } from '../services/s3';
import { S3_PATHS } from '../constants';

interface SnakeQuestion {
  clue: string;
  answer: string; // uppercase, letters only, 3-8 chars
}

/**
 * POST /snake/questions — return 20 trivia Q&A pairs with short answers
 * suitable for the Snake letter-collecting game.
 */
export async function getSnakeQuestions(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const questions: SnakeQuestion[] = [];
    const seenAnswers = new Set<string>();

    // Source 1: Trivia question history (all users)
    try {
      const triviaQuestions = await getAllQuestionsFlat();
      for (const q of triviaQuestions) {
        if (!q.answer || !q.question) continue;
        const clean = q.answer.trim().toUpperCase().replace(/[^A-Z]/g, '');
        if (clean.length >= 3 && clean.length <= 8 && !seenAnswers.has(clean)) {
          seenAnswers.add(clean);
          questions.push({ clue: q.question, answer: clean });
        }
      }
    } catch {
      logger.debug('No trivia history for snake questions');
    }

    // Source 2: Family facts (personal Q&A)
    try {
      const histories = await getAllFactHistories();
      const hierarchy = await getJson<any>(S3_PATHS.FAMILY_HIERARCHY);
      const people = hierarchy?.family?.people || {};

      for (const [userId, entries] of histories) {
        const name = people[userId]?.name || userId;
        for (const entry of entries) {
          if (!entry.answered || entry.skipped || !entry.answer) continue;
          // Try to extract a short keyword
          const words = entry.answer.trim().split(/\s+/);
          for (const word of words) {
            const clean = word.toUpperCase().replace(/[^A-Z]/g, '');
            if (clean.length >= 3 && clean.length <= 8 && !seenAnswers.has(clean)) {
              seenAnswers.add(clean);
              questions.push({
                clue: `${name}: ${entry.question}`,
                answer: clean,
              });
              break; // one answer per fact
            }
          }
        }
      }
    } catch {
      logger.debug('No fact history for snake questions');
    }

    if (questions.length < 5) {
      return errorResponse('Not enough short-answer questions available', 400);
    }

    // Shuffle and return 20
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(20, shuffled.length));

    logger.info('Snake questions loaded', { total: questions.length, selected: selected.length });
    return successResponse({ questions: selected });
  } catch (err: any) {
    logger.error('Snake questions failed', { error: err.message });
    return errorResponse('Failed to load questions', 500);
  }
}
