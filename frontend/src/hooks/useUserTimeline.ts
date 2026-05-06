import { useState, useEffect, useCallback } from 'react';

import { getTimelineData, TimelineData } from '../api/modules/timeline';
import { createLogger } from '../utils/logger';

const logger = createLogger('useUserTimeline');

interface UseUserTimelineOptions {
  userId: string;
  limit?: number;
  enabled?: boolean;
}

interface UseUserTimelineResult {
  timelineData: TimelineData | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
  hasMoreFacts: boolean;
  hasMoreTrivia: boolean;
  loadingMore: boolean;
}

/**
 * Custom hook for fetching user-specific timeline data
 * This is more efficient than loading all timeline data and filtering client-side
 */
export function useUserTimeline({
  userId,
  limit = 20,
  enabled = true,
}: UseUserTimelineOptions): UseUserTimelineResult {
  const [timelineData, setTimelineData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMoreFacts, setHasMoreFacts] = useState(false);
  const [hasMoreTrivia, setHasMoreTrivia] = useState(false);
  const [nextFactCursor, setNextFactCursor] = useState<string | null>(null);
  const [nextTriviaCursor, setNextTriviaCursor] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!enabled || !userId) return;

    try {
      setLoading(true);
      setError(null);

      logger.info(`Fetching timeline data for user: ${userId}`);
      const data = await getTimelineData({
        userId,
        limit,
      });

      setTimelineData(data);

      // Update pagination state
      if (data.pagination) {
        setHasMoreFacts(data.pagination.hasMoreFacts);
        setHasMoreTrivia(data.pagination.hasMoreTrivia);
        setNextFactCursor(data.pagination.nextFactCursor);
        setNextTriviaCursor(data.pagination.nextTriviaCursor);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load timeline data';
      logger.error('Error fetching user timeline data:', errorMessage);
      setError(errorMessage);
      setTimelineData(null);
    } finally {
      setLoading(false);
    }
  }, [userId, limit, enabled]);

  // Load more data — matches main timeline pattern (no timelineData in deps)
  const loadMore = useCallback(async () => {
    if (loadingMore || (!hasMoreFacts && !hasMoreTrivia)) return;

    const cursor = nextFactCursor || nextTriviaCursor;
    if (!cursor) {
      logger.warn('No cursor available for pagination');
      return;
    }

    try {
      setLoadingMore(true);

      const moreData = await getTimelineData({
        userId,
        before: cursor,
        limit,
      });

      setTimelineData((prevData) => {
        if (!prevData) return moreData;
        return {
          ...prevData,
          facts: [...prevData.facts, ...moreData.facts],
          trivia: [...prevData.trivia, ...moreData.trivia],
        };
      });

      if (moreData.pagination) {
        setHasMoreFacts(moreData.pagination.hasMoreFacts);
        setHasMoreTrivia(moreData.pagination.hasMoreTrivia);
        setNextFactCursor(moreData.pagination.nextFactCursor);
        setNextTriviaCursor(moreData.pagination.nextTriviaCursor);
      }
    } catch (err) {
      logger.error('Error loading more user timeline data:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [userId, limit, loadingMore, hasMoreFacts, hasMoreTrivia, nextFactCursor, nextTriviaCursor]);

  // Refresh data
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    timelineData,
    loading,
    error,
    refresh,
    loadMore,
    hasMoreFacts,
    hasMoreTrivia,
    loadingMore,
  };
}
