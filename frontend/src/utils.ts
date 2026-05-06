// File: frontend/src/utils.ts
import { UserConfigResponse } from './api/modules/user';
import { cacheService } from './services/CacheService';

// Get user color from config or fall back to algorithm
export function getUserColor(userId: string): string {
  // Try to get from cache first
  const userConfig = cacheService.get<UserConfigResponse>('user-config');

  if (userConfig && userConfig.users[userId]?.color) {
    // If user found in config, return their color
    return userConfig.users[userId].color;
  }

  // Fallback to original algorithm
  const USER_COLORS = ['#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#FFC107', '#E91E63', '#00BCD4'];

  const idx =
    userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % USER_COLORS.length;
  return USER_COLORS[idx];
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

  if (userConfig && userConfig.users[userId]?.group) {
    return userConfig.users[userId].group;
  }

  // Fallback to old USER_GROUP import for backward compatibility
  return undefined;
}

// Simple delay for demos
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
