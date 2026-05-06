// Module: family
// Family hierarchy, members, and group descriptions

import { apiService } from '../../services/ApiService';
import { cacheService } from '../../services/CacheService';
import { createLogger } from '../../utils/logger';

import type { FamilyHierarchy, FamilySideConfig, MemberStatus } from '@family-trivia/shared';

export type { FamilySideConfig, FamilyHierarchy } from '@family-trivia/shared';
export type { MemberStatus } from '@family-trivia/shared';

// ─── Group description types (locally defined, not from shared) ──────────────

export interface GroupDescription {
  description: string;
  lastUpdated: string;
  updatedBy?: string;
}

export interface GroupDescriptionSuggestion {
  suggestion: string;
  currentDescription: string;
  groupId: string;
}

// ─── Family Hierarchy ────────────────────────────────────────────────────────

const familyLogger = createLogger('FamilyAPI');

// Generic empty fallback for when the API fails
const FALLBACK_HIERARCHY: FamilyHierarchy = {
  version: '1.0',
  family: {
    name: 'Family',
    root: { partners: [] },
    relationships: [],
    people: {},
    groups: {},
  },
};

// Cache variables for getFamilyHierarchy
let hierarchyCache: FamilyHierarchy | null = null;
let lastHierarchyFetch = 0;
const HIERARCHY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves the family hierarchy data
 * @param forceFresh Force a fresh request even if cache is valid
 */
export async function getFamilyHierarchy(forceFresh = false): Promise<FamilyHierarchy> {
  const cacheKey = 'family_hierarchy';

  // Check local in-memory cache first
  if (!forceFresh && hierarchyCache && Date.now() - lastHierarchyFetch < HIERARCHY_CACHE_TTL) {
    familyLogger.debug('Using in-memory cached family hierarchy');
    return hierarchyCache;
  }

  try {
    const response = await apiService.request<
      FamilyHierarchy | { hierarchy: FamilyHierarchy; success: boolean }
    >(
      '/family-hierarchy',
      {
        method: 'GET',
      },
      cacheKey, // Cache for performance
      forceFresh, // Control whether cache is bypassed
    );

    // Add defensive validation to ensure we have valid data
    if (!response) {
      familyLogger.warn('Empty response from API, using fallback data');
      return FALLBACK_HIERARCHY;
    }

    // Log the full response to debug the issue
    familyLogger.debug('Full API response:', JSON.stringify(response));

    // Check if the response IS the hierarchy itself (not wrapped)
    if ('version' in response && 'family' in response) {
      familyLogger.info('Response is the hierarchy data directly');
      hierarchyCache = response as FamilyHierarchy;
      lastHierarchyFetch = Date.now();
      return response as FamilyHierarchy;
    }

    if (!('hierarchy' in response) || !response.hierarchy) {
      familyLogger.warn('Missing hierarchy in API response, using fallback data');
      familyLogger.debug('Response data structure:', JSON.stringify(response));
      return FALLBACK_HIERARCHY;
    }

    // Backend now validates and ensures complete data structure
    familyLogger.debug('Family hierarchy data received successfully from backend');

    // Store in memory cache
    hierarchyCache = response.hierarchy;
    lastHierarchyFetch = Date.now();
    return response.hierarchy;
  } catch (error) {
    familyLogger.error('Failed to fetch family hierarchy, using fallback data:', error);
    return FALLBACK_HIERARCHY;
  }
}

// ─── Group Members ───────────────────────────────────────────────────────────

const groupLogger = createLogger('GroupAPI');

/**
 * Fetch all members for a given group.
 *
 * Special handling for specific groups that might cause errors.
 */
export async function getMembers(groupId: string): Promise<MemberStatus[]> {
  // Cache key used for this request
  const cacheKey = `members_${groupId}`;

  // Clear any previous cached error responses for this group
  apiService.getInternalCacheService().invalidate(cacheKey);

  try {
    // Add cache busting to prevent stale data issues
    const timestamp = Date.now();

    return await apiService.request<MemberStatus[]>(
      `/members?groupId=${encodeURIComponent(groupId)}&_t=${timestamp}`,
      {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      },
      cacheKey,
      true, // Force fresh request
    );
  } catch (error) {
    groupLogger.error(`Failed to get members for group ${groupId}:`, error);
    // Return empty array on error to avoid UI breakage
    return [];
  }
}

// ─── Group Descriptions ──────────────────────────────────────────────────────

const groupsLogger = createLogger('GroupsAPI');

// Global cache of in-flight requests to avoid duplicate requests
const pendingRequests: Record<string, Promise<GroupDescription> | undefined> = {};

// Get a description for the specified group
export async function getGroupDescription(groupId: string): Promise<GroupDescription> {
  const cacheKey = `group_description_${groupId}`;

  // Check if we already have this request in flight
  const existingRequest = pendingRequests[groupId];
  if (existingRequest) {
    groupsLogger.debug(`Using existing in-flight request for group ${groupId}`);
    return existingRequest;
  }

  // Create and store the request promise
  const requestPromise = (async (): Promise<GroupDescription> => {
    try {
      const response = await apiService.request<{ groupId: string; description: GroupDescription }>(
        `/group-description?groupId=${groupId}`,
        {
          method: 'GET',
          cacheDuration: 60 * 60 * 1000, // 1 hour cache for group descriptions
        },
        cacheKey,
      );

      // Make sure we have a valid response with description property
      if (!response || !response.description) {
        // Return a default empty description
        groupsLogger.warn(`No valid description found for group ${groupId}, using default`);
        return {
          description: '',
          lastUpdated: new Date().toISOString(),
        };
      } else {
        return response.description;
      }
    } catch (error) {
      groupsLogger.error(`Error fetching description for group ${groupId}:`, error);
      // Return a default empty description on error
      return {
        description: '',
        lastUpdated: new Date().toISOString(),
      };
    } finally {
      // Remove from pending requests after a short delay to handle
      // rapid sequential requests for the same resource
      setTimeout(() => {
        delete pendingRequests[groupId];
      }, 50);
    }
  })();

  pendingRequests[groupId] = requestPromise;
  return requestPromise;
}

// Global pending request for getAllGroupDescriptions
let pendingAllDescriptionsRequest: Promise<Record<string, GroupDescription>> | null = null;

// Get all group descriptions
export async function getAllGroupDescriptions(): Promise<Record<string, GroupDescription>> {
  const cacheKey = 'all_group_descriptions';

  // Check if we already have this request in flight
  if (pendingAllDescriptionsRequest) {
    groupsLogger.debug('Using existing in-flight request for all group descriptions');
    return pendingAllDescriptionsRequest;
  }

  // Create and store the request promise
  const requestPromise = (async (): Promise<Record<string, GroupDescription>> => {
    try {
      const response = await apiService.request<{ descriptions: Record<string, GroupDescription> }>(
        '/group-description',
        {
          method: 'GET',
          cacheDuration: 60 * 60 * 1000, // 1 hour cache for group descriptions
        },
        cacheKey,
      );

      // Validate response structure
      if (!response || !response.descriptions) {
        groupsLogger.warn('Invalid response format from getAllGroupDescriptions');
        return {};
      } else {
        return response.descriptions;
      }
    } catch (error) {
      groupsLogger.error('Error fetching all group descriptions:', error);
      return {};
    } finally {
      // Remove from pending requests after a short delay
      setTimeout(() => {
        pendingAllDescriptionsRequest = null;
      }, 50);
    }
  })();

  pendingAllDescriptionsRequest = requestPromise;
  return requestPromise;
}

// Update a group description
export async function updateGroupDescription(
  userId: string,
  groupId: string,
  description: string,
): Promise<{ success: boolean; description: GroupDescription }> {
  const cacheKey = `group_description_${groupId}`;

  try {
    const result = await apiService.request<{
      success: boolean;
      groupId: string;
      description: GroupDescription;
    }>(
      '/update-group-description',
      {
        method: 'POST',
        body: JSON.stringify({ userId, groupId, description }),
      },
      undefined, // No cache on write
      true, // Force fresh
    );

    // Invalidate caches
    cacheService.invalidate(cacheKey);
    cacheService.invalidate('all_group_descriptions');

    // Clear in-flight requests to prevent stale data
    delete pendingRequests[groupId];
    pendingAllDescriptionsRequest = null;

    return {
      success: result.success,
      description: result.description,
    };
  } catch (error) {
    groupsLogger.error(`Error updating description for group ${groupId}:`, error);

    // Even on error, clear in-flight requests to prevent stale state
    delete pendingRequests[groupId];
    pendingAllDescriptionsRequest = null;

    return {
      success: false,
      description: {
        description: '',
        lastUpdated: new Date().toISOString(),
      },
    };
  }
}

// Track pending suggestion requests by userId
const pendingSuggestionRequests: Record<string, Promise<GroupDescriptionSuggestion> | undefined> =
  {};

// Get a AI-generated suggestion for a group description
export async function suggestGroupDescription(userId: string): Promise<GroupDescriptionSuggestion> {
  // Check if we already have this request in flight
  const existingRequest = pendingSuggestionRequests[userId];
  if (existingRequest) {
    groupsLogger.debug(`Using existing in-flight suggestion request for user ${userId}`);
    return existingRequest;
  }

  // Create and store the request promise
  const requestPromise = (async (): Promise<GroupDescriptionSuggestion> => {
    try {
      const response = await apiService.request<{
        success: boolean;
        groupId: string;
        suggestion: string;
        currentDescription: string;
      }>(
        '/suggest-group-description',
        {
          method: 'POST',
          body: JSON.stringify({ userId }),
        },
        undefined, // No cache
        true, // Force fresh
      );

      if (!response || !response.groupId || !response.suggestion) {
        groupsLogger.warn(`Invalid suggestion response for user ${userId}`);
        return {
          suggestion: 'Could not generate a suggestion at this time.',
          currentDescription: '',
          groupId: '',
        };
      } else {
        return {
          suggestion: response.suggestion,
          currentDescription: response.currentDescription,
          groupId: response.groupId,
        };
      }
    } catch (error) {
      groupsLogger.error(`Error generating suggestion for user ${userId}:`, error);
      return {
        suggestion: 'Could not generate a suggestion at this time.',
        currentDescription: '',
        groupId: '',
      };
    } finally {
      // Remove from pending requests after a short delay
      setTimeout(() => {
        delete pendingSuggestionRequests[userId];
      }, 50);
    }
  })();

  pendingSuggestionRequests[userId] = requestPromise;
  return requestPromise;
}
