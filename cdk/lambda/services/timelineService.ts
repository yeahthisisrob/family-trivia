// File: lambda/services/timelineService.ts
// Purpose: Optimized timeline data loading service.
// Uses a single listObjects call for all facts instead of per-user,
// sorts by date in the key, and only reads the top N files needed.

import { getJson, listObjects } from './s3';
import { getFactHistory } from './factHistoryService';
import { FactAnswerEntry } from '@family-trivia/shared';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { getRecentRounds } from './familyFeudService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelineFactEntry {
  userId: string;
  username: string;
  groupId: string;
  familySide?: string;
  fact: string;
  category?: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface TimelineTriviaEntry {
  userId: string;
  username: string;
  groupId: string;
  familySide?: string;
  question: string;
  answer: string;
  category: string;
  difficulty: string;
  correct: boolean;
  timestamp: string;
  [key: string]: unknown;
}

export interface TimelinePagination {
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;
  nextFactCursor: string | null;
  nextTriviaCursor: string | null;
}

export interface TimelineResult {
  facts: TimelineFactEntry[];
  trivia: TimelineTriviaEntry[];
  pagination: TimelinePagination;
}

export interface HierarchyPerson {
  name: string;
  groupId: string;
  familySide?: string;
  [key: string]: unknown;
}

export interface TimelineLoadOptions {
  /** Max items per type (facts, trivia) to return. Default 20. */
  limit?: number;
  /** ISO timestamp cursor — only return items older than this. */
  before?: string;
  /** ISO timestamp cursor — only return items newer than this. */
  after?: string;
  /** Family side filter ('all' = no filter). */
  side?: string;
  /** If set, only load for this user. */
  userId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract the YYYY-MM-DD date from a fact S3 key. */
function extractDateFromKey(key: string): string | null {
  const match = key.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  return match ? match[1] : null;
}

/** Extract userId from a fact key like facts/daily/{userId}/basic_0_2026-03-25.json */
function extractUserIdFromKey(key: string): string | null {
  const parts = key.split('/');
  // facts/daily/{userId}/filename.json → parts[2] = userId
  if (parts.length >= 4 && parts[0] === 'facts' && parts[1] === 'daily') {
    return parts[2];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Core: Optimized fact loading
// ---------------------------------------------------------------------------

/**
 * Load the most recent facts across all (or filtered) users.
 *
 * KEY OPTIMIZATION: Instead of calling listObjects per user (17+ calls),
 * we do a single listObjects('facts/daily/') and filter/sort in memory.
 * Then we only read the top N fact files — not hundreds.
 */
export async function getRecentFacts(
  people: Record<string, HierarchyPerson>,
  userIds: string[],
  options: TimelineLoadOptions = {},
): Promise<{ facts: TimelineFactEntry[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = options.limit || 20;
  const userIdSet = new Set(userIds);

  // Load all fact histories for requested users, merge and sort
  const allFacts: { userId: string; entry: FactAnswerEntry }[] = [];
  await Promise.all(
    userIds.map(async (userId) => {
      const entries = await getFactHistory(userId);
      for (const e of entries) {
        if (e.answered && e.question && e.answer && !e.skipped) {
          allFacts.push({ userId, entry: e });
        }
      }
    }),
  );

  // Apply date cursor filters
  let filtered = allFacts;
  if (options.before) {
    const beforeDate = options.before.split('T')[0];
    filtered = filtered.filter(f => f.entry.date < beforeDate);
  }
  if (options.after) {
    const afterDate = options.after.split('T')[0];
    filtered = filtered.filter(f => f.entry.date > afterDate);
  }

  // Sort by date descending (newest first)
  filtered.sort((a, b) => b.entry.date.localeCompare(a.entry.date));

  const hasMore = filtered.length > limit;
  const top = filtered.slice(0, limit);

  const facts: TimelineFactEntry[] = top
    .map(({ userId, entry }) => {
      const person = people[userId];
      if (!person) return null;
      return {
        userId,
        username: person.name,
        groupId: person.groupId,
        familySide: person.familySide,
        question: entry.question,
        answer: entry.answer,
        fact: entry.fact || entry.answer,
        timestamp: entry.timestamp || '',
        questionType: entry.questionType || 'basic',
        answered: true,
        date: entry.date,
      } as unknown as TimelineFactEntry;
    })
    .filter(Boolean) as TimelineFactEntry[];

  // Add completed Family Feud rounds to the facts timeline
  try {
    const feudRounds = await getRecentRounds(20);
    for (const round of feudRounds) {
      if (round.status !== 'completed' || !round.realAnswer) continue;
      const person = people[round.targetUserId];
      if (!person || !userIdSet.has(round.targetUserId)) continue;

      const timestamp = round.results?.revealedAt || round.expiresAt || round.startedAt;
      facts.push({
        userId: round.targetUserId,
        username: person.name,
        groupId: person.groupId,
        familySide: person.familySide,
        fact: round.realAnswer,
        question: round.question,
        answer: round.realAnswer,
        timestamp,
        category: 'Family Feud',
        questionType: 'family-feud',
        isFamilyFeud: true,
        mode: 'family-feud',
        guessCount: Object.keys(round.guesses || {}).length,
        winners: round.results?.winners || [],
        allGuesses: Object.values(round.guesses || {}).map((g: any) => ({
          userName: g.userName,
          guess: g.guess,
          correct: round.realAnswer?.toLowerCase().trim() === g.guess?.toLowerCase().trim(),
        })),
      } as unknown as TimelineFactEntry);
    }
  } catch (e) {
    logger.error('Error loading Family Feud for facts timeline', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Sort by timestamp
  facts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const nextCursor = hasMore && facts.length > 0
    ? facts[facts.length - 1].timestamp
    : null;

  logger.info('Loaded recent facts', {
    totalEntries: allFacts.length,
    filtered: filtered.length,
    returned: facts.length,
    hasMore,
  });

  return { facts, hasMore, nextCursor };
}

// ---------------------------------------------------------------------------
// Core: Trivia history loading
// ---------------------------------------------------------------------------

/**
 * Load trivia answer history for the given users.
 * Each user has a single answers/history/{userId}.json file,
 * so this is already efficient (one read per user).
 * We merge, sort, paginate across all users.
 */
export async function getRecentTrivia(
  people: Record<string, HierarchyPerson>,
  userIds: string[],
  options: TimelineLoadOptions = {},
): Promise<{ trivia: TimelineTriviaEntry[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = options.limit || 20;

  // Parallel: read answer history + casino rush + slot machine for all users
  const userResults = await Promise.all(
    userIds.map(async userId => {
      const person = people[userId];
      if (!person) return [];

      const entries: TimelineTriviaEntry[] = [];

      try {
        // Regular trivia history
        const history = await getJson<Array<Record<string, unknown>>>(S3_PATHS.ANSWER_HISTORY(userId));
        if (history) {
          for (const item of history) {
            entries.push({
              userId,
              username: person.name,
              groupId: person.groupId,
              familySide: person.familySide,
              ...item,
            } as TimelineTriviaEntry);
          }
        }

        // Game mode entries (Casino Rush, Slot Machine, Curling, Tetris)
        // are already in the answer history loaded above. No separate
        // session loading needed — history is the source of truth.
      } catch (err) {
        logger.error('Error loading trivia for user', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      return entries;
    }),
  );

  // Flatten per-user results
  let allTrivia: TimelineTriviaEntry[] = ([] as TimelineTriviaEntry[]).concat(...userResults);

  // Sort all entries
  allTrivia.sort((a: TimelineTriviaEntry, b: TimelineTriviaEntry) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply cursor filters
  if (options.before) {
    const beforeMs = new Date(options.before).getTime();
    allTrivia = allTrivia.filter((t: TimelineTriviaEntry) => new Date(t.timestamp).getTime() < beforeMs);
  }
  if (options.after) {
    const afterMs = new Date(options.after).getTime();
    allTrivia = allTrivia.filter((t: TimelineTriviaEntry) => new Date(t.timestamp).getTime() > afterMs);
  }

  // Paginate
  const hasMore = allTrivia.length > limit;
  const page = allTrivia.slice(0, limit);
  const nextCursor = hasMore && page.length > 0
    ? page[page.length - 1].timestamp
    : null;

  logger.info('Loaded recent trivia', {
    totalEntries: allTrivia.length,
    returned: page.length,
    hasMore,
  });

  return { trivia: page, hasMore, nextCursor };
}

// ---------------------------------------------------------------------------
// Combined: Full timeline load
// ---------------------------------------------------------------------------

/**
 * Load a complete timeline page (facts + trivia) in parallel.
 * This is the main entry point used by both /app-init and /timeline-data.
 */
export async function loadTimeline(
  people: Record<string, HierarchyPerson>,
  userIds: string[],
  options: TimelineLoadOptions = {},
): Promise<TimelineResult> {
  // Load facts and trivia in parallel
  const [factsResult, triviaResult] = await Promise.all([
    getRecentFacts(people, userIds, options),
    getRecentTrivia(people, userIds, options),
  ]);

  return {
    facts: factsResult.facts,
    trivia: triviaResult.trivia,
    pagination: {
      hasMoreFacts: factsResult.hasMore,
      hasMoreTrivia: triviaResult.hasMore,
      nextFactCursor: factsResult.nextCursor,
      nextTriviaCursor: triviaResult.nextCursor,
    },
  };
}
