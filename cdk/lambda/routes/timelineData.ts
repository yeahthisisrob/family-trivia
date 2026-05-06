// File: lambda/routes/timelineData.ts
// Purpose: Timeline data endpoint for pagination / load-more requests.
// Initial load now comes from /app-init. This route handles subsequent pages.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import * as s3Service from '../services/s3';
import { loadTimeline, HierarchyPerson } from '../services/timelineService';
import { logger } from '../services/logger';

interface HierarchyData {
  family: {
    people: Record<string, HierarchyPerson>;
    groups: Record<string, { name: string; description?: string; [key: string]: any }>;
    sides?: Record<string, { name: string; color: string; [key: string]: any }>;
    root?: { partners?: Array<{ id: string }> };
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Timeline data endpoint.
 * Used for initial load (backward compat) and pagination (load more).
 * Delegates to the shared timelineService for optimized S3 access.
 */
export async function getTimelineData(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const queryParams = event.queryStringParameters || {};
    const side = queryParams.side || 'all';
    const userId = queryParams.userId;

    // Pagination parameters
    let limit: number | undefined;
    if (queryParams.limit) {
      limit = parseInt(queryParams.limit, 10);
      if (isNaN(limit) || limit <= 0) {
        return errorResponse('Invalid limit parameter. Must be a positive number.', 400);
      }
    }
    const before = queryParams.before;
    const after = queryParams.after;

    if (before && isNaN(new Date(before).getTime())) {
      return errorResponse('Invalid before parameter. Must be a valid ISO date string.', 400);
    }
    if (after && isNaN(new Date(after).getTime())) {
      return errorResponse('Invalid after parameter. Must be a valid ISO date string.', 400);
    }

    // Load hierarchy
    const hierarchyData = await s3Service.getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
    if (!hierarchyData) {
      return errorResponse('Family hierarchy data not found', 404);
    }

    const people = hierarchyData.family.people || {};
    const allUserIds = Object.keys(people);

    // Filter users
    let filteredUserIds = allUserIds;
    if (userId) {
      if (!people[userId]) {
        return errorResponse(`User ${userId} not found in hierarchy`, 404);
      }
      filteredUserIds = [userId];
    } else if (side !== 'all') {
      const rootPartnerIds = (hierarchyData.family as any).root?.partners?.map((p: any) => p.id) || [];
      filteredUserIds = allUserIds.filter(uid => {
        if (rootPartnerIds.includes(uid)) return true;
        return people[uid]?.familySide === side;
      });
    }

    if (userId) {
      logger.info(`Fetching timeline data for specific user: ${userId}`);
    } else {
      logger.info(`Fetching timeline data for ${filteredUserIds.length} users (side: ${side})`);
    }

    // Delegate to shared timeline service
    const result = await loadTimeline(people, filteredUserIds, {
      limit: limit || 20,
      before,
      after,
      side,
      userId,
    });

    return successResponse({
      timelineData: {
        facts: result.facts,
        trivia: result.trivia,
      },
      familySides: hierarchyData.family.sides || {},
      hierarchyData,
      pagination: result.pagination,
      success: true,
    });
  } catch (err) {
    logger.error('Error fetching timeline data', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      queryParams: event.queryStringParameters,
    });
    return errorResponse('Failed to retrieve timeline data', 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
