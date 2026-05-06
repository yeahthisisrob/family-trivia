// File: lambda/services/questionHistoryService.ts
// Purpose: Cached question history loading.
// Loads all users' answer histories once per Lambda invocation,
// then serves from memory for subsequent calls (e.g., Casino Rush generating 3 questions).

import { getJson } from './s3';
import { getAllUsers } from './users';
import { S3_PATHS } from '../constants';
import { logger } from './logger';

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
// Lambda container but are reset between invocations in practice because Casino Rush
// generates all 3 questions in a single handler call.
let cachedHistories: Map<string, HistoryEntry[]> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds — covers a single Casino Rush session

/**
 * Load answer histories for all users, cached per invocation.
 * First call reads from S3, subsequent calls return cached data.
 */
export async function getAllUserHistories(): Promise<Map<string, HistoryEntry[]>> {
  const now = Date.now();
  if (cachedHistories && (now - cacheTimestamp) < CACHE_TTL) {
    logger.debug('Using cached question histories');
    return cachedHistories;
  }

  const allUsers = await getAllUsers();
  const histories = new Map<string, HistoryEntry[]>();

  logger.info('Loading question histories for all users', { userCount: allUsers.length });

  // Parallel load — much faster than sequential
  const results = await Promise.all(
    allUsers.map(async (uid) => {
      try {
        const history = await getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(uid)) || [];
        return { uid, history };
      } catch {
        return { uid, history: [] as HistoryEntry[] };
      }
    }),
  );

  for (const { uid, history } of results) {
    histories.set(uid, history);
  }

  cachedHistories = histories;
  cacheTimestamp = now;

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
  cachedHistories = null;
  cacheTimestamp = 0;
}
