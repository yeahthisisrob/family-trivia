// File: frontend/src/utils/familyUtils.ts
// Purpose: Frontend utilities for family side determination

import { createLogger } from './logger';
import { UserConfigResponse } from '../api/modules/user';
import { cacheService } from '../services/CacheService';
import { colors } from '../shared/design-system/tokens/colors';

// Initialize logger
const logger = createLogger('FamilyUtils');

// Family side types - these should match the keys in the hierarchy data
export type FamilySide = string;

// Family side information interface
export interface FamilySideInfo {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  groups?: string[];
}

export interface FamilySidesMap {
  [key: string]: FamilySideInfo;
}

// Fallback purple for family sides that don't have a color set
const DEFAULT_SIDE_COLOR = '#6200ea';
const DEFAULT_SIDE_BG = 'rgba(98, 0, 234, 0.1)';

// Default all family option
const DEFAULT_ALL_OPTION = {
  id: 'all',
  label: 'All Family',
  color: colors.defaultUser,
  bgColor: 'rgba(25, 118, 210, 0.1)',
};

// Function to get family sides that can be refreshed
export function getFamilySides(): FamilySidesMap {
  // Default all family option
  const allOption = DEFAULT_ALL_OPTION;
  const result: FamilySidesMap = { all: allOption };

  try {
    // Try to get family hierarchy from cache
    const familyHierarchy = cacheService.get<Record<string, unknown>>('family_hierarchy');

    if (
      familyHierarchy?.family &&
      typeof familyHierarchy.family === 'object' &&
      familyHierarchy.family !== null &&
      'sides' in familyHierarchy.family &&
      familyHierarchy.family.sides
    ) {
      // Use the sides from API data
      const apiSides = familyHierarchy.family.sides as Record<string, unknown>;

      // Add each side to the result
      Object.entries(apiSides).forEach(([key, value]) => {
        const sideValue = value as Record<string, unknown>;
        result[key] = {
          id: (sideValue.id as string) || key,
          label:
            (sideValue.name as string) || `${key.charAt(0).toUpperCase()}${key.slice(1)}'s Side`,
          color: (sideValue.color as string) || DEFAULT_SIDE_COLOR,
          bgColor: (sideValue.bgColor as string) || DEFAULT_SIDE_BG,
          groups: (sideValue.groups as string[]) || [],
        };
      });
    }
  } catch (error) {
    logger.warn('Failed to get family sides from API:', error);
  }

  return result;
}

// Dynamic family sides from the API or cache
export const FAMILY_SIDES: FamilySidesMap = getFamilySides();

// Get groups for each side dynamically from the hierarchy
const getSideGroups = (sideId: string): string[] => {
  // First try to get from the FAMILY_SIDES
  const sideInfo = FAMILY_SIDES[sideId];
  if (sideInfo?.groups && sideInfo.groups.length > 0) {
    return sideInfo.groups;
  }

  // If not found, try to get from the family hierarchy
  const hierarchy = cacheService.get<Record<string, unknown>>('family_hierarchy');
  if (hierarchy?.family && typeof hierarchy.family === 'object' && 'groups' in hierarchy.family) {
    const groups = hierarchy.family.groups as Record<string, Record<string, unknown>>;
    // Filter groups by familySide property
    return Object.entries(groups)
      .filter(([, group]) => group.familySide === sideId)
      .map(([groupId]) => groupId);
  }

  return [];
};

// Shared group for root partners
const getSharedGroup = (): string => {
  // Try to get from cache
  const hierarchy = cacheService.get<Record<string, unknown>>('family_hierarchy');
  if (
    hierarchy?.family &&
    typeof hierarchy.family === 'object' &&
    'root' in hierarchy.family &&
    hierarchy.family.root &&
    typeof hierarchy.family.root === 'object' &&
    'partners' in hierarchy.family.root
  ) {
    const partners = hierarchy.family.root.partners as Array<{ id: string }>;
    // Find the shared group
    if (partners.length >= 2) {
      // Look in hierarchy.family.people to find the groupId
      const partner1 = partners[0].id;
      const partner2 = partners[1].id;

      if (
        'people' in hierarchy.family &&
        hierarchy.family.people &&
        typeof hierarchy.family.people === 'object' &&
        partner1 in (hierarchy.family.people as Record<string, unknown>) &&
        partner2 in (hierarchy.family.people as Record<string, unknown>)
      ) {
        const people = hierarchy.family.people as Record<string, { groupId: string }>;
        if (people[partner1].groupId === people[partner2].groupId) {
          return people[partner1].groupId;
        }
      }
    }
  }

  // Fallback
  return 'root-partners';
};

/**
 * Gets the root partner IDs from the family hierarchy
 * @returns Array of root partner IDs
 */
export function getRootPartnerIds(): string[] {
  // Try to get from cache
  const hierarchy = cacheService.get<Record<string, unknown>>('family_hierarchy');
  if (
    hierarchy?.family &&
    typeof hierarchy.family === 'object' &&
    'root' in hierarchy.family &&
    hierarchy.family.root &&
    typeof hierarchy.family.root === 'object' &&
    'partners' in hierarchy.family.root
  ) {
    const partners = hierarchy.family.root.partners as Array<{ id: string }>;
    return partners.map((partner) => partner.id);
  }

  // Use cached info from other sources as fallback
  const sides = Object.keys(FAMILY_SIDES).filter((key) => key !== 'all');
  if (sides.length >= 2) {
    return sides;
  }

  return [];
}

/**
 * Determines the family side for a given user
 * @param userId User ID to determine side for
 * @returns FamilySide - The side identifier or 'other'
 */
export function getFamilySide(userId: string): FamilySide {
  // Get user config from cache
  const userConfig = cacheService.get<UserConfigResponse>('user-config');

  // If user has explicitly defined side in config, use that
  if (userConfig?.users[userId]?.side) {
    return userConfig.users[userId].side as FamilySide;
  }

  // Try to get from family hierarchy directly
  const hierarchy = cacheService.get<Record<string, unknown>>('family_hierarchy');
  if (
    hierarchy?.family &&
    typeof hierarchy.family === 'object' &&
    'people' in hierarchy.family &&
    hierarchy.family.people &&
    typeof hierarchy.family.people === 'object' &&
    userId in (hierarchy.family.people as Record<string, unknown>)
  ) {
    const person = (hierarchy.family.people as Record<string, { familySide?: string }>)[userId];
    if (person.familySide) {
      return person.familySide;
    }
  }

  // Get user group
  const userGroup = userConfig?.users[userId]?.group;

  // If no group found, return 'other'
  if (!userGroup) return 'other';

  // Get the shared group from hierarchy
  const sharedGroup = getSharedGroup();

  // Root partners are in the shared group but have their own sides
  if (userGroup === sharedGroup) {
    // Check if user is a root partner
    const rootPartners = getRootPartnerIds();
    if (rootPartners.length >= 2) {
      if (userId === rootPartners[0]) return rootPartners[0];
      if (userId === rootPartners[1]) return rootPartners[1];
    }
    // Others in the shared group could be from either side, default to 'other'
    return 'other';
  }

  // Get side groups dynamically
  const sides = Object.keys(FAMILY_SIDES).filter((key) => key !== 'all');
  for (const side of sides) {
    const sideGroups = getSideGroups(side);
    if (sideGroups.includes(userGroup)) {
      return side;
    }
  }

  // Default to 'other'
  return 'other';
}

/**
 * Check if a user is a root family member
 * @param userId User ID to check
 * @returns boolean - true if user is a root member
 */
export function isRootFamilyMember(userId: string): boolean {
  const rootPartners = getRootPartnerIds();
  return rootPartners.includes(userId);
}

/**
 * Determines if a user should be included in the given family side filter.
 * Root members are included in all sides.
 * @param userId User ID to check
 * @param side Family side to filter by
 * @returns boolean - true if user should be included
 */
export function shouldIncludeInFamilySide(userId: string, side: FamilySide | 'all'): boolean {
  // Include all users when side is 'all'
  if (side === 'all') return true;

  // Root members are included in all sides
  if (isRootFamilyMember(userId)) return true;

  // For other members, include if they belong to the selected side
  return getFamilySide(userId) === side;
}
