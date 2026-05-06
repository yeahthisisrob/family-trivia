// ApiService.ts - Core API request functionality
//
// IMPORTANT: This service uses in-memory caching ONLY via the CacheService.
// No data is persisted to localStorage.
// All cache entries are temporary and exist only for the current browser session.
// The backend is always treated as the source of truth for game state.

import { loadConfig } from '../config';
import { getToken, updateToken } from '../session';
import { cacheService } from './CacheService';
import { createLogger } from '../utils/logger';

/** Structured API error thrown when the server returns an error envelope */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: string,
    public readonly errorType?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Service to handle API requests to the backend
 * Uses in-memory caching only (no localStorage) to prevent stale data issues
 */
// Initialize logger
const logger = createLogger('ApiService');

export class ApiService {
  private apiUrl: string | null = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/+$|^""/, '')
    : null;

  /** Read JWT from session storage. */
  static getAuthToken(): string | null { return getToken(); }
  /** Update JWT after silent refresh. */
  static updateAuthToken(token: string) { updateToken(token); }

  /**
   * Returns the configured API URL, loading config.json if needed
   */
  async getApiUrl(): Promise<string> {
    if (!this.apiUrl) {
      try {
        const cfg = await loadConfig();
        this.apiUrl = cfg.REACT_APP_API_URL.replace(/\/+$/g, '');
        // Log only once when the URL is first resolved
        logger.debug('Resolved API URL:', this.apiUrl);
      } catch (error) {
        logger.error('Failed to load API URL from config:', error);
        throw new Error('Could not load API configuration. Please refresh the page and try again.');
      }
    }
    if (!this.apiUrl) {
      throw new Error('API URL is not set');
    }
    return this.apiUrl;
  }

  /**
   * Core API request method with error handling and caching
   */
  async request<T = unknown>(
    endpoint: string,
    options?: RequestInit & {
      cacheKey?: string;
      cacheDuration?: number;
      forceFresh?: boolean;
    },
    legacyCacheKey?: string,
    legacyForceFresh = false,
    timeoutMs?: number,
  ): Promise<T> {
    // Extract cache options from options object or fallback to legacy params
    const cacheKey = options?.cacheKey || legacyCacheKey;
    const forceFresh = options?.forceFresh || legacyForceFresh;
    // Generate error key for tracking fatal errors
    const errorKey = `${endpoint}_${JSON.stringify(options?.body || '')}`;

    // Clear fatal errors for comment endpoints
    if (endpoint.startsWith('/fact-comments')) {
      cacheService.clearEndpointErrors('/fact-comments');
      // Don't immediately return here; proceed with the request
    }
    // For other endpoints, check for fatal errors
    else if (cacheService.hasFatalError(errorKey)) {
      logger.warn(`Skipping request to ${endpoint} due to previous fatal error`);
      return this.getEmptyResult<T>(endpoint);
    }

    // Check if the endpoint is circuit broken
    if (cacheService.isCircuitBroken(endpoint)) {
      logger.warn(`Skipping request to ${endpoint} due to active circuit breaker`);
      return this.getEmptyResult<T>(endpoint);
    }

    // Check cache if applicable
    if (cacheKey && !forceFresh) {
      const cachedData = cacheService.get<T>(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    try {
      const base = await this.getApiUrl();
      const url = `${base}${endpoint}`;

      // Default request options — merge headers so caller-provided headers
      // don't clobber Authorization / Content-Type.
      const token = ApiService.getAuthToken();
      const { headers: callerHeaders, ...restOptions } = options || {};
      const requestOptions: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(callerHeaders as Record<string, string> || {}),
        },
        ...restOptions,
      };

      // Add timeout - use longer timeout for expensive operations
      const controller = new AbortController();
      // Increase timeout for specific endpoints that may take longer
      const isExpensiveOperation =
        endpoint.includes('member-summary') ||
        endpoint.includes('timeline-data') ||
        endpoint.includes('consolidated-leaderboard') ||
        endpoint.includes('generate-question') ||
        endpoint.includes('question-gen/') ||
        endpoint.includes('daily-fact-summary') ||
        endpoint.includes('submit-daily-fact') ||
        endpoint.includes('daily-fact') ||
        endpoint.includes('recent-shared-questions') ||
        endpoint.includes('casino-rush') ||
        endpoint.includes('app-init') ||
        endpoint.includes('fact-comments') ||
        endpoint.includes('members');
      // Use provided timeout or determine based on endpoint
      // In local dev (proxied through Vite), SAM needs more time
      const isLocalDev = import.meta.env.DEV;
      const timeoutDuration = timeoutMs || (isExpensiveOperation ? (isLocalDev ? 120000 : 45000) : (isLocalDev ? 60000 : 10000));
      const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
      requestOptions.signal = controller.signal;

      logger.debug(`Making request to: ${url} (timeout: ${timeoutDuration}ms)`);
      const startTime = Date.now();
      const response = await fetch(url, requestOptions);
      const endTime = Date.now();
      clearTimeout(timeoutId);

      // Silent token refresh — backend returns a fresh JWT when close to expiry
      const refreshedToken = response.headers.get('X-Refreshed-Token');
      if (refreshedToken) {
        ApiService.updateAuthToken(refreshedToken);
      }

      // Log performance metrics for slow requests
      const requestDuration = endTime - startTime;
      if (requestDuration > 1000) {
        // Log any request that takes more than 1 second
        logger.debug(`Request to ${endpoint} completed in ${requestDuration}ms`);
      }

      // Log detailed information about the response
      logger.debug(`Response from ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()),
        ok: response.ok,
      });

      // Check for HTML responses (which indicate errors)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.toLowerCase().includes('text/html')) {
        logger.error(
          `Received HTML response from ${endpoint} - This indicates a misconfigured API`,
        );

        // Mark this as a fatal error
        cacheService.markFatalError(errorKey);

        // Try to extract useful information from the HTML
        const htmlContent = await response.text();
        const errorMatch =
          htmlContent.match(/<title>(.*?)<\/title>/i) ||
          htmlContent.match(/<h1>(.*?)<\/h1>/i) ||
          htmlContent.match(/<body>(.*?)<\/body>/i);

        const errorMessage = errorMatch ? errorMatch[1] : 'Received HTML instead of JSON response';
        throw new Error(`API Error: ${errorMessage}`);
      }

      // Parse JSON response but handle errors gracefully
      let data: T;
      try {
        const text = await response.text();

        // Log full response for 500 errors to help debug server issues
        if (response.status === 500) {
          logger.error(`API error response (500):`, {
            endpoint,
            responseText: text,
          });
        }

        if (!response.ok) {
          logger.error(`API error response (${response.status}): ${text}`);
          throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
        }

        // Handle empty responses gracefully
        if (!text || text.trim() === '') {
          logger.warn(`Empty response received from ${endpoint}`);
          data = {} as T;
        } else {
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            logger.error(`JSON parse error for response from ${endpoint}:`, parseError);
            logger.debug(
              `Response text that failed to parse:`,
              text.substring(0, 500) + (text.length > 500 ? '...' : ''),
            );

            // For endpoints that are critical to the app, mark as fatal error
            if (!endpoint.includes('/casino-rush') && !endpoint.includes('/comments')) {
              cacheService.markFatalError(errorKey);
            }

            // Return empty object for comments endpoint
            if (endpoint.includes('/comments')) {
              logger.warn(`Returning empty data for comments endpoint ${endpoint}`);
              return {} as T;
            }

            // Log more details for casino rush endpoints
            if (endpoint.includes('/casino-rush')) {
              logger.error(`Casino Rush API parse error for ${endpoint}:`, {
                parseError,
                responseText: text ? text.substring(0, 200) : 'empty',
              });
              return {} as T;
            }

            throw new Error(`Invalid response format from API. Please try again.`);
          }
        }
      } catch (error) {
        logger.error(`Failed to process response from ${endpoint}:`, error);

        // Don't mark non-critical endpoints as fatal
        if (!endpoint.includes('/casino-rush') && !endpoint.includes('/comments')) {
          // Mark as fatal error - don't retry for most issues
          cacheService.markFatalError(errorKey);
        }

        // For comments endpoints, return empty object instead of throwing
        if (endpoint.includes('/comments')) {
          logger.warn(`Returning empty data after error for comments endpoint ${endpoint}`);
          return {} as T;
        }

        // For casino rush endpoints, log detailed error but still return empty object
        // The casinoRush.ts functions will check these empty responses
        if (endpoint.includes('/casino-rush')) {
          logger.error(`Casino Rush API process error for ${endpoint}:`, {
            error,
            endpoint,
          });
          return {} as T;
        }

        throw new Error(`Invalid response format from API. Please try again.`);
      }

      // Unwrap response envelope if present
      data = this.unwrapEnvelope<T>(data, response.status);

      // Cache the response if needed
      if (cacheKey) {
        // Use the specified cache duration or default to CacheService's default
        const cacheDuration = options?.cacheDuration;
        cacheService.set(cacheKey, data, cacheDuration);
      }

      return data;
    } catch (error: unknown) {
      // Special handling for comment endpoints
      const isCommentEndpoint = endpoint.startsWith('/fact-comments');

      if (!isCommentEndpoint) {
        // Record error against endpoint for circuit breaking (except for comments)
        cacheService.recordEndpointError(endpoint);

        // Mark as fatal error (except for comments)
        cacheService.markFatalError(errorKey);
      } else {
        // For comment endpoints, just log the error but don't circuit break
        logger.warn(`Comment API error (will retry next time): ${endpoint}`, error);
      }

      // Handle specific error types
      if (error instanceof Error && error.name === 'AbortError') {
        logger.error('Request timed out');
        throw new Error('Request timed out. Please try again.');
      }

      logger.error(`API request to ${endpoint} failed:`, error);

      // For certain endpoints, return empty results to avoid UI breakage
      return this.getEmptyResult<T>(endpoint);
    }
  }

  /**
   * Detect and unwrap the standard response envelope { ok, data } or { ok, error }.
   * Non-enveloped responses pass through unchanged for backward compatibility.
   */
  private unwrapEnvelope<T>(data: unknown, statusCode: number): T {
    if (
      typeof data === 'object' &&
      data !== null &&
      'ok' in data &&
      typeof (data as Record<string, unknown>).ok === 'boolean'
    ) {
      const envelope = data as { ok: boolean; data?: unknown; error?: string; details?: string; errorType?: string };
      if (envelope.ok === false) {
        throw new ApiError(
          envelope.error || 'Unknown server error',
          statusCode,
          envelope.details,
          envelope.errorType,
        );
      }
      return envelope.data as T;
    }
    return data as T;
  }

  /**
   * Helper to return appropriate empty results for different endpoint types
   */
  private getEmptyResult<T>(endpoint: string): T {
    if (endpoint.includes('/members')) {
      logger.warn('Returning empty members array due to error');
      return [] as unknown as T;
    }

    // Default empty result
    if (Array.isArray([] as unknown as T)) {
      return [] as unknown as T;
    }
    return {} as T;
  }

  /**
   * Clear all cached API responses and reset error tracking
   */
  clearCache(): void {
    cacheService.clearAll();
  }

  /**
   * Expose the internal cache service for certain operations
   * This is primarily used for handling failures in a more graceful way
   */
  getInternalCacheService() {
    return cacheService;
  }

  /**
   * Check if the given endpoint is circuit broken
   */
  isEndpointCircuitBroken(endpoint: string): boolean {
    return cacheService.isCircuitBroken(endpoint);
  }
}

// Create a singleton instance
export const apiService = new ApiService();
