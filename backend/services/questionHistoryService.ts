// File: lambda/services/questionHistoryService.ts
// Purpose: Cached question history loading.
// Loads all users' answer histories once per Lambda invocation,
// then serves from memory for subsequent calls (e.g., a game writing 3 questions at once).

import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { getJson } from './s3';
import { circleCache } from './scope';
import { getAllUsers } from './users';

interface QuestionRecord {
  question: string;
  choices?: string[];
  answer?: string;
  category?: string;
  difficulty?: string;
  [key: string]: unknown;
}

interface HistoryEntry {
  question?: QuestionRecord;
  timestamp?: string;
  [key: string]: unknown;
}

// Per-invocation cache. Module-level variables persist across calls within a single
// Lambda container but are reset between invocations in practice because a game
// that asks several questions writes them all in a single handler call.
const historiesCache = circleCache<Map<string, HistoryEntry[]>>(30_000); // covers one multi-question play

/**
 * Load answer histories for all users, cached per invocation.
 * First call reads from S3, subsequent calls return cached data.
 */
export async function getAllUserHistories(): Promise<Map<string, HistoryEntry[]>> {
  const cached = historiesCache.get();
  if (cached) {
    logger.debug('Using cached question histories');
    return cached;
  }

  const allUsers = await getAllUsers();
  const histories = new Map<string, HistoryEntry[]>();

  logger.info('Loading question histories for all users', { userCount: allUsers.length });

  // Parallel load — much faster than sequential
  const results = await Promise.all(
    allUsers.map(async (uid) => {
      try {
        const history = (await getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(uid))) || [];
        return { uid, history };
      } catch {
        return { uid, history: [] as HistoryEntry[] };
      }
    }),
  );

  for (const { uid, history } of results) {
    histories.set(uid, history);
  }

  historiesCache.set(histories);

  logger.info('Question histories loaded and cached', {
    userCount: histories.size,
    totalEntries: Array.from(histories.values()).reduce((sum, h) => sum + h.length, 0),
  });

  return histories;
}

/**
 * Get all questions from all users as a flat array (for duplicate checking).
 * Uses the cached histories.
 */
export async function getAllQuestionsFlat(limit?: number): Promise<QuestionRecord[]> {
  const histories = await getAllUserHistories();
  const allQuestions: QuestionRecord[] = [];

  for (const history of histories.values()) {
    for (const entry of history) {
      if (entry.question) {
        allQuestions.push(entry.question);
      }
    }
  }

  // Return most recent N questions (for duplicate checking)
  if (limit && allQuestions.length > limit) {
    return allQuestions.slice(-limit);
  }
  return allQuestions;
}

/**
 * Get history for a single user (uses cache if available).
 */
export async function getUserHistory(userId: string): Promise<HistoryEntry[]> {
  const histories = await getAllUserHistories();
  return histories.get(userId) || [];
}

/**
 * Invalidate the cache (e.g., after a new answer is submitted).
 */
export function invalidateHistoryCache(): void {
  historiesCache.clear();
}
