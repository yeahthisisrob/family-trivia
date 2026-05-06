// CacheService.ts - Handles all caching functionality for API requests
//
// IMPORTANT: This service uses in-memory caching ONLY. No data is persisted to localStorage.
// All cache entries are temporary and exist only for the current browser session.
// This is by design to prevent stale data from persisting between sessions.
// The backend is the source of truth for all game state.

import { createLogger } from '../utils/logger';

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Service to handle API request caching
 * All caching is in-memory and temporary for the current session only.
 * This prevents issues with stale cache data persisting between browser sessions.
 */
// Initialize logger
const logger = createLogger('CacheService');

export class CacheService {
  private cache: Record<string, CacheEntry<unknown>> = {};
  private fatalErrors: Record<string, boolean> = {};
  private errorCounts: Record<string, number> = {};
  private endpointCircuitBreakers: Record<string, number> = {}; // Tracks timestamps when endpoints are circuit broken
  private cacheTTL: number;

  constructor(cacheTTL = 60000) {
    // Default 1 minute TTL
    this.cacheTTL = cacheTTL;
  }

  /**
   * Get a value from cache if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache[key];
    if (entry && entry.expiry > Date.now()) {
      return entry.data as T;
    }
    return null;
  }

  /**
   * Store a value in the cache
   * @param key The cache key
   * @param data The value to cache
   * @param customTTL Optional custom TTL in milliseconds (overrides default cacheTTL)
   */
  set<T>(key: string, data: T, customTTL?: number): void {
    const expiry = Date.now() + (customTTL || this.cacheTTL);
    this.cache[key] = {
      data,
      expiry,
    };
  }

  /**
   * Clear specific cache entry
   */
  invalidate(key: string): void {
    delete this.cache[key];
  }

  /**
   * Clear all cache entries that match a pattern
   */
  invalidatePattern(pattern: string): void {
    Object.keys(this.cache).forEach((key) => {
      if (key.includes(pattern)) {
        this.invalidate(key);
      }
    });
  }

  /**
   * Clear all cached entries
   */
  clearCache(): void {
    this.cache = {};
  }

  /**
   * Check if this request has a fatal error
   */
  hasFatalError(key: string): boolean {
    return !!this.fatalErrors[key];
  }

  /**
   * Mark a request as having a fatal error
   */
  markFatalError(key: string): void {
    this.fatalErrors[key] = true;
  }

  /**
   * Clear all fatal error flags
   */
  clearFatalErrors(): void {
    this.fatalErrors = {};
  }

  /**
   * Record an error for an endpoint
   */
  recordEndpointError(endpoint: string): number {
    // Extract the base endpoint path without query parameters
    const baseEndpoint = endpoint.split('?')[0];
    this.errorCounts[baseEndpoint] = (this.errorCounts[baseEndpoint] || 0) + 1;

    // If too many errors, engage circuit breaker
    // Be more forgiving for group-description endpoints (higher threshold)
    const errorThreshold = baseEndpoint.includes('group-description') ? 5 : 3;

    if (this.errorCounts[baseEndpoint] >= errorThreshold) {
      this.engageCircuitBreaker(baseEndpoint);
    }

    return this.errorCounts[baseEndpoint];
  }

  /**
   * Engage circuit breaker for endpoint
   */
  engageCircuitBreaker(endpoint: string): void {
    // Circuit break for 5 minutes
    this.endpointCircuitBreakers[endpoint] = Date.now() + 5 * 60 * 1000;
    logger.warn(`Circuit breaker engaged for endpoint ${endpoint} for 5 minutes`);
  }

  /**
   * Check if endpoint is circuit broken
   */
  isCircuitBroken(endpoint: string): boolean {
    // Extract the base endpoint
    const baseEndpoint = endpoint.split('?')[0];

    // Never circuit break comment-related endpoints
    if (baseEndpoint === '/fact-comments') {
      return false;
    }

    const breakUntil = this.endpointCircuitBreakers[baseEndpoint];

    // If no circuit breaker is engaged, return false immediately
    if (!breakUntil) return false;

    // Check if the circuit break period is still active
    if (breakUntil > Date.now()) {
      // For group-description endpoint, allow specific group queries through
      // This prevents blocking all group description requests when only one is failing
      if (baseEndpoint === '/group-description' && endpoint.includes('groupId=')) {
        // Extract the groupId
        const match = endpoint.match(/groupId=([^&]+)/);
        if (match && match[1]) {
          // Only block this request if we have a specific fatal error for this group
          const specificErrorKey = `${endpoint}_`;
          if (!this.hasFatalError(specificErrorKey)) {
            return false;
          }
        }
      }
      return true; // Circuit is still broken
    } else {
      // Circuit break period is over, reset
      delete this.endpointCircuitBreakers[baseEndpoint];
      this.errorCounts[baseEndpoint] = 0;
    }

    return false;
  }

  /**
   * Clear errors for a specific endpoint
   */
  clearEndpointErrors(endpoint: string): void {
    delete this.errorCounts[endpoint];
    delete this.endpointCircuitBreakers[endpoint];
  }

  /**
   * Clear everything - both cache and error tracking
   */
  clearAll(): void {
    this.clearCache();
    this.clearFatalErrors();
    this.errorCounts = {};
    this.endpointCircuitBreakers = {};
  }
}

// Create a singleton instance
export const cacheService = new CacheService();
