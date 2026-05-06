import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

import { useFamilyData } from './FamilyDataContext';
import {
  getCommentThread as fetchThread,
  getCommentCounts as fetchCounts,
  addComment as apiAddComment,
} from '../api/modules/social';
import { TimelineData, getTimelineData } from '../api/modules/timeline';
import { FamilySide } from '../utils/familyUtils';
import { createLogger } from '../utils/logger';

import type {
  Comment,
  CommentThread,
  CommentContentType,
} from '../api/modules/social';

// Initialize logger
const logger = createLogger('TimelineContext');

// Re-export unified types for consumers
export type { Comment, CommentThread, CommentContentType };

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

// Timeline context type
interface TimelineContextType {
  // Timeline data
  timelineData: TimelineData;
  selectedSide: FamilySide | 'all';
  lastRefreshed: number;

  // Comments data
  commentCounts: Map<string, number>;
  commentCommenters: Map<string, string[]>;
  commentsLoading: boolean;
  commentsLastRefreshed: number;

  // Loading states
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  initialLoadDone: boolean;

  // Pagination
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;

  // Timeline actions
  setSelectedSide: (side: FamilySide | 'all') => void;
  refreshTimeline: (forceRefresh?: boolean) => Promise<boolean>;
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
  // Get init data from FamilyDataContext (loaded in consolidated /app-init call)
  const { initTimelineData, appInitComplete, hierarchyData } = useFamilyData();
  const initConsumedRef = React.useRef(false);

  // Timeline data state
  const [timelineData, setTimelineData] = useState<TimelineData>({
    facts: [],
    trivia: [],
    familySides: {},
  });

  // Selected family side
  const [selectedSide, setSelectedSide] = useState<FamilySide | 'all'>('all');

  // Loading and error states — start false, set true only when actively fetching
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Track last refresh for cache invalidation
  const [lastRefreshed, setLastRefreshed] = useState<number>(0);

  // Use refs to avoid dependency issues
  const lastRefreshedRef = React.useRef(lastRefreshed);
  const hasDataRef = React.useRef(false);
  const retryCountRef = React.useRef(0);
  const retryTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pagination state
  const [hasMoreFacts, setHasMoreFacts] = useState<boolean>(false);
  const [hasMoreTrivia, setHasMoreTrivia] = useState<boolean>(false);
  const [nextFactCursor, setNextFactCursor] = useState<string | null>(null);
  const [nextTriviaCursor, setNextTriviaCursor] = useState<string | null>(null);

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

  // Update refs when values change
  React.useEffect(() => {
    lastRefreshedRef.current = lastRefreshed;
  }, [lastRefreshed]);

  React.useEffect(() => {
    hasDataRef.current = timelineData.trivia.length > 0 || timelineData.facts.length > 0;
  }, [timelineData]);

  // Fetch timeline data. Returns true if data was loaded, false if empty/error.
  const fetchTimelineData = useCallback(
    async (forceRefresh = false): Promise<boolean> => {
      try {
        setLoading(true);

        // Only use in-memory cache if initial load is done, we have REAL data, and it's fresh
        const now = Date.now();
        const hasMeaningfulData =
          hasDataRef.current &&
          (timelineData.trivia.length > 0 || timelineData.facts.length > 0);
        if (!forceRefresh && initialLoadDone && hasMeaningfulData && now - lastRefreshedRef.current < CACHE_DURATION) {
          logger.debug('Using cached timeline data');
          setLoading(false);
          return true;
        }

        logger.info(`Fetching timeline data for side: ${selectedSide}`);

        // Initial load - get the most recent data without date restrictions
        const data = await getTimelineData({
          side: selectedSide,
          limit: 20, // Load 20 items of each type initially
        });

        const hasData = data.trivia.length > 0 || data.facts.length > 0;
        if (!hasData) {
          logger.warn('Timeline data is empty');
        }

        // Update state with new data
        logger.info(`Timeline data received: facts=${data.facts.length}, trivia=${data.trivia.length}, hasData=${data.trivia.length > 0 || data.facts.length > 0}`);
        setTimelineData(data);
        setLastRefreshed(now);
        setError(null);
        // Mark initial load done only when we have data or retries are exhausted
        if (!initialLoadDone && (hasData || retryCountRef.current >= 3)) {
          setInitialLoadDone(true);
        }

        // Update pagination state
        if (data.pagination) {
          setHasMoreFacts(data.pagination.hasMoreFacts);
          setHasMoreTrivia(data.pagination.hasMoreTrivia);
          setNextFactCursor(data.pagination.nextFactCursor);
          setNextTriviaCursor(data.pagination.nextTriviaCursor);
        }

        return hasData;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Unknown error loading timeline data';
        logger.error('Error fetching timeline data:', errorMessage);
        setError(errorMessage);
        // Don't block the app forever — mark done after retries exhausted or on error
        if (!initialLoadDone && retryCountRef.current >= 3) {
          setInitialLoadDone(true);
        }
        return false;
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedSide], // timelineData intentionally excluded to avoid infinite loop
  );

  // Refresh timeline data (exposed to consumers)
  const refreshTimeline = useCallback(
    async (forceRefresh = false) => {
      return fetchTimelineData(forceRefresh);
    },
    [fetchTimelineData],
  );

  // Load more timeline data
  const loadMoreTimeline = useCallback(async () => {
    if (loadingMore || (!hasMoreFacts && !hasMoreTrivia)) {
      return;
    }

    try {
      setLoadingMore(true);
      logger.info('Loading more timeline data');

      // Use the oldest cursor available
      const cursor = nextFactCursor || nextTriviaCursor;
      if (!cursor) {
        logger.warn('No cursor available for pagination');
        return;
      }

      const moreData = await getTimelineData({
        side: selectedSide,
        before: cursor,
        limit: 20,
      });

      // Merge new data with existing, deduplicating by userId+timestamp
      setTimelineData((prevData) => {
        const factKeys = new Set(prevData.facts.map((f) => `${f.userId}_${f.timestamp}`));
        const triviaKeys = new Set(prevData.trivia.map((t) => `${t.userId}_${t.timestamp}`));
        const newFacts = moreData.facts.filter((f) => !factKeys.has(`${f.userId}_${f.timestamp}`));
        const newTrivia = moreData.trivia.filter((t) => !triviaKeys.has(`${t.userId}_${t.timestamp}`));
        return {
          ...prevData,
          facts: [...prevData.facts, ...newFacts],
          trivia: [...prevData.trivia, ...newTrivia],
        };
      });

      // Update pagination state
      if (moreData.pagination) {
        logger.info('Pagination update:', {
          hasMoreFacts: moreData.pagination.hasMoreFacts,
          hasMoreTrivia: moreData.pagination.hasMoreTrivia,
          nextFactCursor: moreData.pagination.nextFactCursor,
          nextTriviaCursor: moreData.pagination.nextTriviaCursor,
          newDataCount: { facts: moreData.facts.length, trivia: moreData.trivia.length },
        });
        setHasMoreFacts(moreData.pagination.hasMoreFacts);
        setHasMoreTrivia(moreData.pagination.hasMoreTrivia);
        setNextFactCursor(moreData.pagination.nextFactCursor);
        setNextTriviaCursor(moreData.pagination.nextTriviaCursor);
      }
    } catch (err) {
      logger.error('Error loading more timeline data:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMoreFacts, hasMoreTrivia, nextFactCursor, nextTriviaCursor, selectedSide]);

  // Hydrate from consolidated /app-init response when available.
  // This avoids a separate /timeline-data API call at init.
  useEffect(() => {
    if (initConsumedRef.current || !appInitComplete || !initTimelineData) return;
    initConsumedRef.current = true;

    logger.info('Hydrating timeline from app-init data', {
      facts: initTimelineData.facts.length,
      trivia: initTimelineData.trivia.length,
    });

    const data: TimelineData = {
      facts: initTimelineData.facts || [],
      trivia: initTimelineData.trivia || [],
      familySides: initTimelineData.familySides || {},
      hierarchyData: (hierarchyData as unknown as TimelineData['hierarchyData']) || undefined,
      pagination: initTimelineData.pagination,
    };

    setTimelineData(data);
    setLastRefreshed(Date.now());
    setError(null);

    if (initTimelineData.pagination) {
      setHasMoreFacts(initTimelineData.pagination.hasMoreFacts);
      setHasMoreTrivia(initTimelineData.pagination.hasMoreTrivia);
      setNextFactCursor(initTimelineData.pagination.nextFactCursor);
      setNextTriviaCursor(initTimelineData.pagination.nextTriviaCursor);
    }

    setInitialLoadDone(true);
  }, [appInitComplete, initTimelineData, hierarchyData]);

  // Fallback: if app-init didn't include timeline data (no userId), load separately.
  // Also handles side changes after init (pagination uses /timeline-data endpoint).
  useEffect(() => {
    // Skip if init data will handle it
    if (!initConsumedRef.current && initTimelineData) return;
    // Skip on first mount if we already hydrated from init
    if (initConsumedRef.current && selectedSide === 'all' && initialLoadDone) return;

    retryCountRef.current = 0;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);

    const loadWithRetry = async () => {
      const gotData = await fetchTimelineData();

      if (!gotData && retryCountRef.current < 3) {
        retryCountRef.current++;
        const delay = retryCountRef.current * 3000;
        logger.info(`Timeline empty, scheduling retry ${retryCountRef.current}/3 in ${delay}ms`);
        retryTimerRef.current = setTimeout(() => {
          lastRefreshedRef.current = 0;
          loadWithRetry();
        }, delay);
      } else if (!gotData) {
        setInitialLoadDone(true);
      }
    };

    loadWithRetry();

    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSide, fetchTimelineData]); // fetchTimelineData closes over selectedSide

  // Handle side selection
  const handleSideChange = useCallback(
    (side: FamilySide | 'all') => {
      if (side !== selectedSide) {
        // Reset pagination and cache so the effect-triggered fetch gets fresh data
        setHasMoreFacts(false);
        setHasMoreTrivia(false);
        setNextFactCursor(null);
        setNextTriviaCursor(null);
        lastRefreshedRef.current = 0; // invalidate cache so effect fetch is not skipped
        setSelectedSide(side); // triggers the useEffect which calls fetchTimelineData
      }
    },
    [selectedSide],
  );

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
      const factIds = (timelineData.facts || []).map(
        (f) => `${f.userId}_${f.timestamp}`,
      );
      const triviaIds = (timelineData.trivia || []).map(
        (t) => `${t.userId}_${t.timestamp}`,
      );

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
      if (cached && cached._fetchedAt && Date.now() - cached._fetchedAt < 60_000) {
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
          return { contentType, contentId, comments: [], lastUpdated: new Date().toISOString() } as CommentThread;
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
  const refreshComments = useCallback(
    () => refreshCommentCounts(),
    [refreshCommentCounts],
  );

  // Context value
  const contextValue: TimelineContextType = {
    // Timeline data
    timelineData,
    selectedSide,
    loading,
    loadingMore,
    error,
    initialLoadDone,
    hasMoreFacts,
    hasMoreTrivia,
    setSelectedSide: handleSideChange,
    refreshTimeline,
    loadMoreTimeline,
    lastRefreshed,

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
