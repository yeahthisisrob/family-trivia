import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void | Promise<void>;
  hasMore: boolean;
  loading?: boolean;
  threshold?: number;
  rootMargin?: string;
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  loading = false,
  threshold = 0.1,
  rootMargin = '100px',
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(loading);
  const nodeRef = useRef<HTMLElement | null>(null);

  // Update loading ref when loading changes
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  // Re-observe the node when loading completes
  useEffect(() => {
    if (!loading && nodeRef.current && hasMore && observerRef.current) {
      observerRef.current.observe(nodeRef.current);
    }
  }, [loading, hasMore]);

  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      // Store the node reference
      nodeRef.current = node;

      // Disconnect previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      // Don't observe if no more data
      if (!hasMore) {
        return;
      }

      if (node) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
              onLoadMore();
            }
          },
          {
            threshold,
            rootMargin,
          },
        );

        observerRef.current.observe(node);
      }
    },
    [hasMore, onLoadMore, threshold, rootMargin],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return sentinelRef;
}
