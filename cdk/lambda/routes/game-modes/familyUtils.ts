// File: lambda/routes/game-modes/familyUtils.ts
// Purpose: Utilities for family side determination and group classification
// used by the slot machine game mode.

import { getJson } from '../../services/s3';
import { S3_PATHS } from '../../constants';
import { logger } from '../../services/logger';

// Family side is now a generic string (side IDs come from hierarchy data)
export type FamilySide = string;

// Interface for user config data
interface UserConfigData {
  version: string;
  lastUpdated: string;
  users: Record<string, {
    group: string;
    color: string;
    side?: string;
  }>;
}

// Hierarchy data shape
interface HierarchyData {
  family: {
    root: { partners: { id: string; name: string }[] };
    sides?: Record<string, { id: string; name: string; color: string; groups: string[] }>;
    people: Record<string, { id: string; name: string; groupId?: string; familySide?: string }>;
    groups: Record<string, { id: string; name: string; members: string[]; familySide?: string }>;
  };
}

// In-memory caches
let hierarchyCache: HierarchyData | null = null;
let hierarchyCacheTime = 0;
const HIERARCHY_CACHE_TTL = 60_000; // 1 minute

async function getHierarchy(): Promise<HierarchyData | null> {
  const now = Date.now();
  if (hierarchyCache && (now - hierarchyCacheTime < HIERARCHY_CACHE_TTL)) {
    return hierarchyCache;
  }
  try {
    const data = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);
    if (data) {
      hierarchyCache = data;
      hierarchyCacheTime = now;
    }
    return data;
  } catch (err) {
    logger.error('Error loading family hierarchy', {
      error: err instanceof Error ? err.message : String(err),
    });
    return hierarchyCache; // return stale cache on error
  }
}

/**
 * Get root partner IDs from hierarchy
 */
export async function getRootPartnerIds(): Promise<string[]> {
  const hierarchy = await getHierarchy();
  if (!hierarchy?.family?.root?.partners) return [];
  return hierarchy.family.root.partners.map(p => p.id);
}

/**
 * Determines the family side for a given user or group.
 * Looks up everything dynamically from S3 data.
 *
 * @param userId User ID to determine side for
 * @param group  Optional group ID (if already known)
 * @returns The side ID string, or 'other'
 */
export async function getFamilySide(userId: string, group?: string): Promise<FamilySide> {
  // 1. Check user config for explicitly defined side
  const userConfig = await getUserConfig();
  if (userConfig?.users[userId]?.side) {
    return userConfig.users[userId].side as FamilySide;
  }

  // 2. Load hierarchy
  const hierarchy = await getHierarchy();

  // 3. Check person-level familySide in hierarchy
  if (hierarchy?.family?.people?.[userId]?.familySide) {
    return hierarchy.family.people[userId].familySide as FamilySide;
  }

  // 4. Determine group
  const userGroup = group || userConfig?.users[userId]?.group;
  if (!userGroup) return 'other';

  // 5. Check if user is a root partner (they're in the shared group)
  const rootPartners = hierarchy?.family?.root?.partners || [];
  const rootPartnerIds = rootPartners.map(p => p.id);
  if (rootPartnerIds.includes(userId)) {
    // Root partners: check if there's a side that matches their userId
    if (hierarchy?.family?.sides?.[userId]) {
      return userId;
    }
    // Otherwise just return 'other' — they're the root couple
    return 'other';
  }

  // 6. Check hierarchy.family.sides to find which side owns this group
  if (hierarchy?.family?.sides) {
    for (const [sideId, sideData] of Object.entries(hierarchy.family.sides)) {
      if (sideData.groups && sideData.groups.includes(userGroup)) {
        return sideId;
      }
    }
  }

  // 7. Check group-level familySide
  if (hierarchy?.family?.groups?.[userGroup]?.familySide) {
    return hierarchy.family.groups[userGroup].familySide as FamilySide;
  }

  return 'other';
}

/**
 * Gets the user config from S3
 */
async function getUserConfig(): Promise<UserConfigData | null> {
  try {
    return await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
  } catch (err) {
    logger.error('Error loading user config', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Determines if the user is on a specific family side
 */
export async function isOnSide(userId: string, side: string, group?: string): Promise<boolean> {
  const userSide = await getFamilySide(userId, group);
  return userSide === side;
}

/**
 * Find a user from the same family side as the given user.
 * Used for personal questions in game modes.
 */
export async function getUserFromSameFamily(userId: string): Promise<{ id: string; name: string } | null> {
  try {
    const userConfig = await getUserConfig();
    if (!userConfig) {
      logger.warn('Could not get user config for finding family members', { userId });
      return null;
    }

    const userSide = await getFamilySide(userId);
    if (userSide === 'other') {
      logger.info('User is not on a specific family side', { userId });
      return null;
    }

    // Find all users on the same side
    const candidates: string[] = [];
    for (const [otherUserId, userData] of Object.entries(userConfig.users)) {
      if (otherUserId === userId) continue;
      const otherSide = await getFamilySide(otherUserId, userData.group);
      if (otherSide === userSide) {
        candidates.push(otherUserId);
      }
    }

    if (candidates.length === 0) {
      logger.warn('No family members found on the same side', { userId, side: userSide });
      return null;
    }

    const randomUserId = candidates[Math.floor(Math.random() * candidates.length)];

    // Get user name from hierarchy
    const hierarchy = await getHierarchy();
    const person = hierarchy?.family?.people?.[randomUserId];
    return {
      id: randomUserId,
      name: person?.name || randomUserId,
    };
  } catch (error) {
    logger.error('Error finding user from same family', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
