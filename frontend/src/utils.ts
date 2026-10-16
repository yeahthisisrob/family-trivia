// File: frontend/src/utils.ts
import type { UserConfigResponse } from './api/modules/user';
import { cacheService } from './services/CacheService';
import { identityColor } from './shared/design-system';

// A color set in user config wins; otherwise the person's identity color.
export function getUserColor(userId: string): string {
  const userConfig = cacheService.get<UserConfigResponse>('user-config');
  return userConfig?.users[userId]?.color || identityColor(userId);
}

/**
 * Get user initials from userId
 * Handles different formats:
 * - Names with hyphens: "john-doe" -> "JD"
 * - Names with underscores: "john_doe" -> "JD"
 * - Names with spaces: "john doe" -> "JD"
 * - Single names: "john" -> "JO"
 */
export function getUserInitials(userId: string): string {
  // Check for separators (hyphen, underscore, space)
  const parts = userId.split(/[-_ ]/);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  // Fallback for single names (take first two letters)
  return userId.slice(0, 2).toUpperCase();
}

// Get user group from config
export function getUserGroup(userId: string): string | undefined {
  // Try to get from cache first
  const userConfig = cacheService.get<UserConfigResponse>('user-config');

  if (userConfig?.users[userId]?.group) {
    return userConfig.users[userId].group;
  }

  // Fallback to old USER_GROUP import for backward compatibility
  return undefined;
}

// Simple delay for demos
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
