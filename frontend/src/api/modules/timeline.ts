// Module: timeline
// Timeline data and daily fact summaries

import { apiService } from '../../services/ApiService';
import { cacheService } from '../../services/CacheService';
import { createLogger } from '../../utils/logger';

import type { DailyFactSummary, PaginationInfo, TimelineData, TimelineOptions } from '@family-trivia/shared';

export type { DailyFactSummary, PaginationInfo, TimelineData, TimelineOptions } from '@family-trivia/shared';

const logger = createLogger('TimelineAPI');

/**
 * Get consolidated timeline data for both facts and trivia
 * This replaces the need to fetch each user's profile separately
 *
 * @param options - Options for filtering and pagination
 * @returns Timeline data containing facts and trivia entries
 */
export async function getTimelineData(options: TimelineOptions = {}): Promise<TimelineData> {
  const { side = 'all', userId, limit, before, after } = options;
  try {
    // Build query parameters
    const params = new URLSearchParams();
    params.append('side', side);
    if (userId) params.append('userId', userId);
    if (limit) params.append('limit', limit.toString());
    if (before) params.append('before', before);
    if (after) params.append('after', after);

    // Fetch timeline data with a fresh request and longer timeout for this important API
    const response = await apiService.request<{
      timelineData: Pick<TimelineData, 'facts' | 'trivia'>;
      familySides: TimelineData['familySides'];
      hierarchyData?: TimelineData['hierarchyData'];
      pagination?: PaginationInfo;
      success: boolean;
    }>(
      `/timeline-data?${params.toString()}`,
      {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      },
      undefined, // No cache key - always fetch fresh
      true, // Force fresh request
      30000, // 30 second timeout for initial load (Lambda cold start)
    );

    if (!response.success) {
      throw new Error('Failed to fetch timeline data');
    }

    // Use the hierarchy data from the response if available
    let hierarchyData = response.hierarchyData;

    // If not included in response, fall back to fetching separately (backward compatibility)
    if (!hierarchyData) {
      logger.info('Hierarchy data not included in timeline response, fetching separately');
      try {
        const hierarchyResponse = await apiService.request<{
          hierarchy: TimelineData['hierarchyData'];
          success: boolean;
        }>(
          '/family-hierarchy',
          { method: 'GET' },
          'family_hierarchy',
          false, // Use cache if available
        );
        hierarchyData = hierarchyResponse?.hierarchy || { family: { people: {}, groups: {} } };
        logger.info('Successfully fetched family hierarchy data separately');
      } catch (hierarchyError) {
        logger.warn('Could not fetch family hierarchy separately:', hierarchyError);
        // Provide a minimal valid structure to prevent null references
        hierarchyData = { family: { people: {}, groups: {} } };
      }
    } else {
      logger.info('Using hierarchy data included in timeline response');
    }

    // Return combined data
    return {
      facts: response.timelineData.facts || [],
      trivia: response.timelineData.trivia || [],
      familySides: response.familySides || {},
      hierarchyData,
      pagination: response.pagination,
    };
  } catch (error) {
    logger.error('Error fetching timeline data:', error);

    // Return empty results so the page still renders (timeline will retry)
    return {
      facts: [],
      trivia: [],
      familySides: {},
    };
  }
}

export async function getDailyFactSummary(
  date?: string,
  forceGenerate?: boolean,
  isWeekly?: boolean,
): Promise<DailyFactSummary> {
  const params = new URLSearchParams();

  if (isWeekly) {
    // For weekly summaries, date should be the week start date
    if (date) params.set('weekStart', date);
  } else {
    // For daily summaries
    if (date) params.set('date', date);
  }

  if (forceGenerate) params.set('forceGenerate', 'true');

  const queryString = params.toString();
  const url = `/daily-fact-summary${queryString ? `?${queryString}` : ''}`;

  // If force generating, invalidate any existing cache
  const cacheKey = `${isWeekly ? 'weekly' : 'daily'}-fact-summary-${date || 'yesterday'}`;
  if (forceGenerate) {
    cacheService.invalidate(cacheKey);
  }

  return apiService.request<DailyFactSummary>(url, {
    method: 'GET',
    cacheKey: forceGenerate ? undefined : cacheKey,
    cacheDuration: forceGenerate ? 0 : 5 * 60 * 1000, // Cache for 5 minutes unless forcing
  });
}
