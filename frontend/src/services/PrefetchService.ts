import { apiService } from './ApiService';
import { createLogger } from '../utils/logger';

const logger = createLogger('PrefetchService');

interface PrefetchOptions {
  priority?: 'high' | 'low';
  delay?: number;
}

class PrefetchService {
  private prefetchQueue: Map<string, Promise<unknown>> = new Map();
  private idleCallbackId: number | null = null;

  /**
   * Prefetch data that might be needed soon
   * Uses requestIdleCallback for low priority prefetches
   */
  prefetch<T = unknown>(endpoint: string, cacheKey: string, options: PrefetchOptions = {}): void {
    const { priority = 'low', delay = 0 } = options;

    // Skip if already prefetching or cached
    if (this.prefetchQueue.has(cacheKey)) {
      return;
    }

    // Check if data is already cached
    const cached = apiService.getInternalCacheService().get(cacheKey);
    if (cached) {
      logger.debug(`Data already cached for ${cacheKey}, skipping prefetch`);
      return;
    }

    if (priority === 'high') {
      // High priority - fetch immediately
      setTimeout(() => {
        this.executePrefetch<T>(endpoint, cacheKey);
      }, delay);
    } else {
      // Low priority - use idle callback
      this.scheduleIdlePrefetch(endpoint, cacheKey);
    }
  }

  /**
   * Prefetch multiple endpoints
   */
  prefetchBatch(
    requests: Array<{ endpoint: string; cacheKey: string }>,
    options: PrefetchOptions = {},
  ): void {
    requests.forEach(({ endpoint, cacheKey }) => {
      this.prefetch(endpoint, cacheKey, options);
    });
  }

  /**
   * Schedule prefetch during idle time
   */
  private scheduleIdlePrefetch(endpoint: string, cacheKey: string): void {
    if ('requestIdleCallback' in window) {
      this.idleCallbackId = window.requestIdleCallback(
        () => {
          this.executePrefetch(endpoint, cacheKey);
        },
        { timeout: 2000 }, // Max wait time
      );
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        this.executePrefetch(endpoint, cacheKey);
      }, 100);
    }
  }

  /**
   * Execute the actual prefetch
   */
  private async executePrefetch<T>(endpoint: string, cacheKey: string): Promise<void> {
    if (this.prefetchQueue.has(cacheKey)) {
      return;
    }

    logger.debug(`Prefetching data for ${endpoint}`);

    const prefetchPromise = apiService
      .request<T>(endpoint, { method: 'GET' }, cacheKey)
      .then((data) => {
        logger.debug(`Successfully prefetched ${endpoint}`);
        return data;
      })
      .catch((error) => {
        logger.warn(`Failed to prefetch ${endpoint}:`, error);
        return null;
      })
      .finally(() => {
        this.prefetchQueue.delete(cacheKey);
      });

    this.prefetchQueue.set(cacheKey, prefetchPromise);
  }

  /**
   * Cancel all pending prefetches
   */
  cancelAll(): void {
    if (this.idleCallbackId !== null && 'cancelIdleCallback' in window) {
      window.cancelIdleCallback(this.idleCallbackId);
      this.idleCallbackId = null;
    }
    this.prefetchQueue.clear();
  }

  /**
   * Prefetch predictable navigation patterns
   */
  prefetchNavigationData(currentUserId: string | null): void {
    if (!currentUserId) return;

    // Prefetch user's profile data
    this.prefetch(`/profile/${currentUserId}`, `profile_${currentUserId}`, {
      priority: 'low',
      delay: 1000,
    });

    // Prefetch user's question status
    this.prefetch(`/question-status?userId=${currentUserId}`, `question_status_${currentUserId}`, {
      priority: 'low',
      delay: 2000,
    });

    // Prefetch categories (commonly accessed)
    this.prefetch('/categories', 'categories', { priority: 'low', delay: 3000 });
  }

  /**
   * Prefetch data based on user interaction patterns
   */
  prefetchOnHover(dataType: 'profile' | 'leaderboard' | 'timeline', id?: string): void {
    switch (dataType) {
      case 'profile':
        if (id) {
          this.prefetch(`/profile/${id}`, `profile_${id}`, { priority: 'high', delay: 200 });
        }
        break;

      case 'leaderboard':
        // Prefetch full leaderboard data
        this.prefetch('/consolidated-leaderboard', 'consolidated_leaderboard', {
          priority: 'high',
          delay: 200,
        });
        break;

      case 'timeline':
        // Prefetch next page of timeline data
        if (id) {
          // id would be the cursor for pagination
          this.prefetch(`/timeline-data?before=${id}`, `timeline_before_${id}`, {
            priority: 'high',
            delay: 200,
          });
        }
        break;
    }
  }
}

// Create singleton instance
export const prefetchService = new PrefetchService();
