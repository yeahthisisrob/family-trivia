/**
 * Fact History Service — single source of truth for daily fact answers.
 *
 * Replaces the old model of N individual files per user (facts/daily/{userId}/*.json)
 * with ONE consolidated file per user (facts/answers/{userId}.json).
 *
 * All consumers that previously scanned per-user directories now read from here.
 */

import { getJson, putJson, listObjects } from './s3';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { FactAnswerEntry } from '@family-trivia/shared';

// ── In-memory cache per Lambda invocation ─────────────────────────

const cache = new Map<string, FactAnswerEntry[]>();

export function invalidateFactHistoryCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

// ── Read ──────────────────────────────────────────────────────────

/** Get a single user's fact answer history */
export async function getFactHistory(userId: string): Promise<FactAnswerEntry[]> {
  if (cache.has(userId)) return cache.get(userId)!;

  try {
    const entries = await getJson<FactAnswerEntry[]>(S3_PATHS.FACT_ANSWER_HISTORY(userId));
    const result = entries || [];
    cache.set(userId, result);
    return result;
  } catch {
    cache.set(userId, []);
    return [];
  }
}

/** Get all users' fact histories. Returns a map of userId → entries. */
export async function getAllFactHistories(): Promise<Map<string, FactAnswerEntry[]>> {
  const keys = await listObjects('facts/answers/');
  const result = new Map<string, FactAnswerEntry[]>();

  await Promise.all(
    keys.map(async (key) => {
      const match = key.match(/facts\/answers\/(.+)\.json$/);
      if (!match) return;
      const userId = match[1];
      const entries = await getFactHistory(userId);
      result.set(userId, entries);
    }),
  );

  return result;
}

/** Get a user's answered dates (shared questions only) as a Set */
export async function getAnsweredDates(userId: string): Promise<Set<string>> {
  const entries = await getFactHistory(userId);
  return new Set(
    entries
      .filter(e => e.questionType === 'shared' && (e.answered || e.skipped))
      .map(e => e.date),
  );
}

/** Get a user's answered shared entries as a map of date → entry */
export async function getSharedAnswersByDate(userId: string): Promise<Map<string, FactAnswerEntry>> {
  const entries = await getFactHistory(userId);
  const map = new Map<string, FactAnswerEntry>();
  for (const e of entries) {
    if (e.questionType === 'shared') map.set(e.date, e);
  }
  return map;
}

/** Get a user's basic question answers */
export async function getBasicAnswers(userId: string): Promise<FactAnswerEntry[]> {
  const entries = await getFactHistory(userId);
  return entries.filter(e => e.questionType === 'basic');
}

/** Check if a user has answered a specific basic question index */
export async function hasAnsweredBasicQuestion(userId: string, questionIndex: number): Promise<boolean> {
  const entries = await getFactHistory(userId);
  return entries.some(e => e.questionType === 'basic' && e.questionIndex === questionIndex && e.answered);
}

/** Count completed basic questions */
export async function countCompletedBasicQuestions(userId: string): Promise<number> {
  const entries = await getFactHistory(userId);
  const completedIndices = new Set<number>();
  for (const e of entries) {
    if (e.questionType === 'basic' && e.answered && e.questionIndex !== undefined) {
      completedIndices.add(e.questionIndex);
    }
  }
  return completedIndices.size;
}

// ── Write ─────────────────────────────────────────────────────────

/** Append a fact answer to the user's history */
export async function appendFactAnswer(userId: string, entry: FactAnswerEntry): Promise<void> {
  const entries = await getFactHistory(userId);

  // If a prior SKIPPED entry exists for the same question (same date +
  // questionType + questionIndex for basics), REPLACE it. Allows users
  // to un-skip accidental skips and actually answer. Real answers
  // (skipped: false) are never replaced.
  const matchIdx = entries.findIndex(e =>
    e.date === entry.date &&
    e.questionType === entry.questionType &&
    e.questionIndex === entry.questionIndex &&
    e.skipped === true,
  );
  if (matchIdx >= 0) {
    entries[matchIdx] = entry;
    logger.info('Replaced skipped fact entry with new answer', {
      userId, date: entry.date, type: entry.questionType,
    });
  } else {
    entries.push(entry);
  }

  await putJson(S3_PATHS.FACT_ANSWER_HISTORY(userId), entries);
  cache.set(userId, entries);
  logger.info('Saved fact answer', { userId, date: entry.date, type: entry.questionType });
}

/** Get the total number of shared facts a user has answered (not skipped) */
export async function countAnsweredSharedFacts(userId: string): Promise<number> {
  const entries = await getFactHistory(userId);
  return entries.filter(e => e.questionType === 'shared' && e.answered && !e.skipped).length;
}

/** Get all fact content for a user (for AI context, profiles, etc.) */
export async function getFactContent(userId: string): Promise<{ question: string; answer: string; fact: string; date: string }[]> {
  const entries = await getFactHistory(userId);
  return entries
    .filter(e => e.answered && !e.skipped && e.answer && e.answer !== '[Skipped]')
    .map(e => ({ question: e.question, answer: e.answer, fact: e.fact, date: e.date }));
}

/** Get unique shared questions across all users, optionally filtered by date range */
export async function getRecentSharedQuestions(opts?: {
  since?: string;       // YYYY-MM-DD — only questions on or after this date
  limit?: number;       // max questions to return
}): Promise<string[]> {
  const allHistories = await getAllFactHistories();
  const seen = new Set<string>();
  const questions: string[] = [];
  const since = opts?.since;
  const limit = opts?.limit ?? 50;

  for (const entries of allHistories.values()) {
    for (const e of entries) {
      if (e.questionType !== 'shared') continue;
      if (since && e.date < since) continue;
      if (e.question && !seen.has(e.question)) {
        seen.add(e.question);
        questions.push(e.question);
      }
      if (seen.size >= limit) break;
    }
    if (seen.size >= limit) break;
  }

  return questions;
}
