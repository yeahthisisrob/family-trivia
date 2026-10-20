import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type Comment,
  type CommentContentType,
  type CommentThread,
  commentsApi,
} from '../features/comments';

const {
  addComment: apiAddComment,
  getCommentCounts: fetchCounts,
  getCommentThread: fetchThread,
} = commentsApi;

import { type TimelineFeed, useTimelineFeed } from '../entities/timeline';
import { createLogger } from '../shared/lib/logger';
import type { FamilySide } from '../utils/familyUtils';

// Initialize logger
const logger = createLogger('TimelineContext');

// Re-export unified types for consumers
export type { Comment, CommentContentType, CommentThread };

/** The family timeline Home shows (server data: entities/timeline). */
type TimelineData = Pick<TimelineFeed, 'facts' | 'trivia' | 'familySides'>;

const NOTHING_YET: TimelineData = { facts: [], trivia: [], familySides: {} };

// Timeline context type
interface TimelineContextType {
  // Timeline data
  timelineData: TimelineData;
  selectedSide: FamilySide | 'all';

  // Comments data
  commentCounts: Map<string, number>;
  commentCommenters: Map<string, string[]>;
  commentsLoading: boolean;
  commentsLastRefreshed: number;

  // Loading states
  loadingMore: boolean;
  error: string | null;

  // Pagination
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;

  // Timeline actions
  setSelectedSide: (side: FamilySide | 'all') => void;
  /** Ask for the timeline again (after an answer the timeline shows). */
  refreshTimeline: (forceRefresh?: boolean) => Promise<void>;
  loadMoreTimeline: () => Promise<void>;

  // Comments actions — unified for both fact and trivia
  getComments: (contentType: CommentContentType, contentId: string) => Comment[];
  fetchComments: (contentType: CommentContentType, contentId: string) => Promise<CommentThread>;
  addComment: (
    contentType: CommentContentType,
    contentId: string,
    userId: string,
    text: string,
    parentId?: string,
  ) => Promise<Comment>;
  refreshCommentCounts: () => Promise<void>;

  // Deprecated — kept for backwards compat with existing consumers
  /** @deprecated Use getComments('fact', id) */
  getCommentsForFact: (factId: string) => Comment[];
  /** @deprecated Use getComments('trivia', id) */
  getCommentsForTrivia: (triviaId: string) => Comment[];
  /** @deprecated Use fetchComments('trivia', id) */
  fetchTriviaCommentsForId: (triviaId: string) => Promise<CommentThread>;
  /** @deprecated Use refreshCommentCounts() */
  refreshComments: () => Promise<void>;
}

// Create context (exported so tests / stories can provide stub values)
export const TimelineContext = createContext<TimelineContextType | null>(null);

// Provider props
interface TimelineProviderProps {
  children: React.ReactNode;
}

export const TimelineProvider: React.FC<TimelineProviderProps> = ({ children }) => {
  // Selected family side: each side is its own list (a side kept on screen while another loads)
  const [selectedSide, setSelectedSide] = useState<FamilySide | 'all'>('all');
  const feed = useTimelineFeed(selectedSide);
  const timelineData = feed.data ?? NOTHING_YET;
  const initialLoadDone = feed.data !== undefined || feed.isError;
  // A failed refresh keeps what's on screen; only a timeline that never came says so.
  const error = feed.isError && !feed.data ? feed.error.message : null;

  const { refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = feed;
  const refreshTimeline = useCallback(async () => {
    await refetch();
  }, [refetch]);
  const loadMoreTimeline = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) await fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Unified comments state
  // Full threads keyed by "fact:contentId" or "trivia:contentId"
  const [commentThreads, setCommentThreads] = useState<Map<string, CommentThread>>(new Map());
  // Lightweight counts for timeline badges, keyed the same way
  const [commentCounts, setCommentCounts] = useState<Map<string, number>>(new Map());
  const [commentCommenters, setCommentCommenters] = useState<Map<string, string[]>>(new Map());
  // Deduplicate concurrent fetches
  const inFlightFetches = React.useRef<Map<string, Promise<CommentThread>>>(new Map());
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLastRefreshed, setCommentsLastRefreshed] = useState(0);
  const [commentsInitialized, setCommentsInitialized] = useState(false);

  // Track if comments are currently being refreshed to prevent duplicate calls
  const isRefreshingCommentsRef = React.useRef(false);

  // Helper: cache key for a comment thread
  const cacheKey = (contentType: CommentContentType, contentId: string) =>
    `${contentType}:${contentId}`;

  // ── Refresh comment counts (lightweight, for timeline badges) ──
  const refreshCommentCounts = useCallback(async () => {
    if (isRefreshingCommentsRef.current) {
      logger.debug('Comment count refresh already in progress, skipping');
      return;
    }
    isRefreshingCommentsRef.current = true;
    setCommentsLoading(true);
    try {
      // Collect IDs from timeline data
      const factIds = (timelineData.facts || []).map((f) => `${f.userId}_${f.timestamp}`);
      const triviaIds = (timelineData.trivia || []).map((t) => `${t.userId}_${t.timestamp}`);

      // Fetch counts in parallel
      const emptyResult = { counts: {}, commenters: {} };
      const [factResult, triviaResult] = await Promise.all([
        factIds.length > 0 ? fetchCounts('fact', factIds) : emptyResult,
        triviaIds.length > 0 ? fetchCounts('trivia', triviaIds) : emptyResult,
      ]);

      // Merge into Maps
      const newCounts = new Map<string, number>();
      const newCommenters = new Map<string, string[]>();
      for (const [id, count] of Object.entries(factResult.counts)) {
        const n = Number(count);
        if (n > 0) newCounts.set(cacheKey('fact', id), n);
      }
      for (const [id, userIds] of Object.entries(factResult.commenters)) {
        newCommenters.set(cacheKey('fact', id), userIds);
      }
      for (const [id, count] of Object.entries(triviaResult.counts)) {
        const n = Number(count);
        if (n > 0) newCounts.set(cacheKey('trivia', id), n);
      }
      for (const [id, userIds] of Object.entries(triviaResult.commenters)) {
        newCommenters.set(cacheKey('trivia', id), userIds);
      }

      setCommentCounts(newCounts);
      setCommentCommenters(newCommenters);
      setCommentsLastRefreshed(Date.now());
      logger.info(`Refreshed comment counts: ${newCounts.size} items with comments`);
    } catch (error) {
      logger.error('Failed to refresh comment counts:', error);
    } finally {
      setCommentsLoading(false);
      isRefreshingCommentsRef.current = false;
    }
  }, [timelineData]);

  // Initialize comment counts AFTER initial timeline load
  useEffect(() => {
    if (initialLoadDone && !commentsInitialized) {
      refreshCommentCounts();
      setCommentsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadDone, commentsInitialized]);

  // Refresh counts periodically (5 minutes)
  useEffect(() => {
    const REFRESH_INTERVAL = 5 * 60 * 1000;
    const intervalId = setInterval(() => {
      if (Date.now() - commentsLastRefreshed > REFRESH_INTERVAL) {
        refreshCommentCounts();
      }
    }, 60000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsLastRefreshed]);

  // ── Synchronous read from cache (no auto-fetch) ──
  const getComments = useCallback(
    (contentType: CommentContentType, contentId: string): Comment[] => {
      const thread = commentThreads.get(cacheKey(contentType, contentId));
      return thread?.comments || [];
    },
    [commentThreads],
  );

  // ── Lazy fetch with dedup + 60s cache ──
  const fetchComments = useCallback(
    async (contentType: CommentContentType, contentId: string): Promise<CommentThread> => {
      const key = cacheKey(contentType, contentId);

      // Return cached if fresh
      const cached = commentThreads.get(key);
      if (cached?._fetchedAt && Date.now() - cached._fetchedAt < 60_000) {
        return cached;
      }

      // Deduplicate in-flight
      const existing = inFlightFetches.current.get(key);
      if (existing) return existing;

      const promise = fetchThread(contentType, contentId)
        .then((thread) => {
          const enriched = { ...thread, _fetchedAt: Date.now() } as CommentThread;
          setCommentThreads((prev) => new Map(prev).set(key, enriched));
          // Also update counts
          setCommentCounts((prev) => {
            const next = new Map(prev);
            if (thread.comments.length > 0) next.set(key, thread.comments.length);
            else next.delete(key);
            return next;
          });
          inFlightFetches.current.delete(key);
          return enriched;
        })
        .catch((err) => {
          inFlightFetches.current.delete(key);
          logger.error(`Failed to fetch comments for ${key}:`, err);
          return {
            contentType,
            contentId,
            comments: [],
            lastUpdated: new Date().toISOString(),
          } as CommentThread;
        });

      inFlightFetches.current.set(key, promise);
      return promise;
    },
    [commentThreads],
  );

  // ── Add a comment (unified, with optimistic update) ──
  const addComment = useCallback(
    async (
      contentType: CommentContentType,
      contentId: string,
      userId: string,
      text: string,
      parentId?: string,
    ): Promise<Comment> => {
      const key = cacheKey(contentType, contentId);
      logger.debug(`Adding comment to ${key}`);

      // Optimistic update
      const optimisticComment: Comment = {
        id: `temp_${Date.now()}`,
        userId,
        text,
        timestamp: new Date().toISOString(),
        parentId,
      };

      setCommentThreads((prev) => {
        const next = new Map(prev);
        const thread = next.get(key);
        const comments = thread?.comments || [];
        next.set(key, {
          ...(thread || { contentType, contentId }),
          comments: [...comments, optimisticComment],
          lastUpdated: new Date().toISOString(),
          _fetchedAt: Date.now(), // preserve to prevent re-fetch race
        } as unknown as CommentThread);
        return next;
      });

      // Update count optimistically
      setCommentCounts((prev) => {
        const next = new Map(prev);
        next.set(key, (prev.get(key) || 0) + 1);
        return next;
      });

      try {
        const newComment = await apiAddComment(contentType, contentId, userId, text, parentId);

        // Replace optimistic with real
        setCommentThreads((prev) => {
          const next = new Map(prev);
          const thread = next.get(key);
          if (thread) {
            next.set(key, {
              ...thread,
              comments: thread.comments.map((c) =>
                c.id === optimisticComment.id ? newComment : c,
              ),
              lastUpdated: new Date().toISOString(),
            });
          }
          return next;
        });

        return newComment;
      } catch (error) {
        // Rollback optimistic update
        setCommentThreads((prev) => {
          const next = new Map(prev);
          const thread = next.get(key);
          if (thread) {
            next.set(key, {
              ...thread,
              comments: thread.comments.filter((c) => c.id !== optimisticComment.id),
            });
          }
          return next;
        });
        setCommentCounts((prev) => {
          const next = new Map(prev);
          const current = prev.get(key) || 1;
          if (current <= 1) next.delete(key);
          else next.set(key, current - 1);
          return next;
        });

        logger.error(`Error adding comment to ${key}:`, error);
        throw new Error(`Failed to add comment: ${(error as Error).message}`);
      }
    },
    [],
  );

  // ── Deprecated compat shims ──
  const getCommentsForFact = useCallback(
    (factId: string) => getComments('fact', factId),
    [getComments],
  );
  const getCommentsForTrivia = useCallback(
    (triviaId: string) => getComments('trivia', triviaId),
    [getComments],
  );
  const fetchTriviaCommentsForId = useCallback(
    (triviaId: string) => fetchComments('trivia', triviaId),
    [fetchComments],
  );
  const refreshComments = useCallback(() => refreshCommentCounts(), [refreshCommentCounts]);

  // Context value
  const contextValue: TimelineContextType = {
    // Timeline data
    timelineData,
    selectedSide,
    loadingMore: isFetchingNextPage,
    error,
    hasMoreFacts: feed.data?.hasMoreFacts ?? false,
    hasMoreTrivia: feed.data?.hasMoreTrivia ?? false,
    setSelectedSide,
    refreshTimeline,
    loadMoreTimeline,

    // Comments data
    commentCounts,
    commentCommenters,
    commentsLoading,
    commentsLastRefreshed,
    getComments,
    fetchComments,
    addComment,
    refreshCommentCounts,
    // Deprecated compat shims
    getCommentsForFact,
    getCommentsForTrivia,
    fetchTriviaCommentsForId,
    refreshComments,
  };

  return <TimelineContext.Provider value={contextValue}>{children}</TimelineContext.Provider>;
};

// Custom hook for using timeline context
export const useTimeline = (): TimelineContextType => {
  const context = useContext(TimelineContext);
  if (!context) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }
  return context;
};
