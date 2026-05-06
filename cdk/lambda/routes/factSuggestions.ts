/**
 * GET /fact-suggestions
 *
 * Returns common opening phrases extracted from real family answers.
 * Used for client-side autocomplete starters — helps users get going
 * by showing how the family naturally talks about memories and facts.
 *
 * No individual answers are returned — just the common patterns.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { getAllFactHistories } from '../services/factHistoryService';

/**
 * Extract the most common opening phrases from all family answers.
 * Takes first 2-3 words of each answer, counts frequency, returns top N.
 */
function extractStarters(answers: string[], topN = 15): string[] {
  const counts = new Map<string, number>();

  for (const answer of answers) {
    const words = answer.trim().split(/\s+/);
    if (words.length < 2) continue;

    for (const len of [3, 2]) {
      if (words.length >= len) {
        const prefix = words.slice(0, len).join(' ');
        if (prefix.length < 4) continue;
        counts.set(prefix, (counts.get(prefix) || 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([phrase]) => phrase);
}

export async function getFactSuggestions(
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const allHistories = await getAllFactHistories();

    const allAnswerTexts: string[] = [];
    for (const [, entries] of allHistories) {
      for (const entry of entries) {
        if (entry.answer && !entry.skipped) {
          allAnswerTexts.push(entry.answer.trim());
        }
      }
    }

    const starters = extractStarters(allAnswerTexts);

    logger.info('Fact starters built', { answers: allAnswerTexts.length, starters: starters.length });

    return successResponse({ starters });
  } catch (err) {
    logger.error('Error building fact suggestions', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('Failed to load suggestions', 500);
  }
}
