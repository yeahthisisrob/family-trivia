/**
 * The family timeline, as server data (docs/decisions/0035): everyone's
 * answers to the daily question and to trivia, newest first, twenty of each
 * at a time. Each family side is its own list, and so is each person's.
 * Anything that adds to it (an answer, a Feud round) invalidates `TIMELINE`.
 */
import type { ResponseOf } from '../../../shared/api/contract';
import { useCircleInfiniteQuery } from '../../../shared/api/query';

type Page = ResponseOf<'/timeline-data'>;
export type TimelineFact = Page['timelineData']['facts'][number];
export type TimelineTrivia = Page['timelineData']['trivia'][number];

export interface TimelineFeed {
  facts: TimelineFact[];
  trivia: TimelineTrivia[];
  familySides: Page['familySides'];
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;
}

export const TIMELINE = ['timeline'] as const;

/** Items asked for per page, of each kind. */
const PAGE_SIZE = 20;

const idOf = (item: { userId: string; timestamp: string }) => `${item.userId}_${item.timestamp}`;

/** Later pages can repeat an item at the edge: each shows once. */
function once<T extends { userId: string; timestamp: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const id = idOf(item);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function asFeed(pages: Page[]): TimelineFeed {
  const last = pages.at(-1)?.pagination;
  return {
    facts: once(pages.flatMap((p) => p.timelineData.facts)),
    trivia: once(pages.flatMap((p) => p.timelineData.trivia)),
    familySides: pages[0]?.familySides ?? {},
    hasMoreFacts: last?.hasMoreFacts ?? false,
    hasMoreTrivia: last?.hasMoreTrivia ?? false,
  };
}

type Filter = { side: string } | { side: string; userId: string };

/** The next page goes back from the oldest cursor the last page gave. */
const nextPage = (filter: Filter) => (page: Page) => {
  const { hasMoreFacts, hasMoreTrivia, nextFactCursor, nextTriviaCursor } = page.pagination;
  const before = nextFactCursor || nextTriviaCursor;
  return (hasMoreFacts || hasMoreTrivia) && before
    ? { ...filter, limit: PAGE_SIZE, before }
    : undefined;
};

export const useTimelineFeed = (side: string) =>
  useCircleInfiniteQuery({
    key: TIMELINE,
    path: '/timeline-data',
    query: { side, limit: PAGE_SIZE },
    next: nextPage({ side }),
    select: asFeed,
    keepPrevious: true,
  });

/** One person's answers (their profile): every family side, theirs only. */
export const usePersonTimeline = (userId: string) =>
  useCircleInfiniteQuery({
    key: TIMELINE,
    path: '/timeline-data',
    query: { side: 'all', userId, limit: PAGE_SIZE },
    next: nextPage({ side: 'all', userId }),
    select: asFeed,
  });
