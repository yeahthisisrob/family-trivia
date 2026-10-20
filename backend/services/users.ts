// File: lambda/services/users.ts

import { S3_PATHS } from '../constants';
import { accountIsPlaying, loadFamily } from './family/roster';
import { logger } from './logger';
import { getJson } from './s3';
import { circleCache } from './scope';

// Types for user configuration
export interface UserConfig {
  group: string;
  color: string;
  passphrase?: string;
  isAdmin?: boolean;
  side?: string;
}

export interface UserConfigData {
  version: string;
  lastUpdated: string;
  users: Record<string, UserConfig>;
}

/**
 * The user config without secrets, safe to send to any signed-in player.
 * Passphrases are one-time links to a Google account; only admins see them,
 * through the admin routes.
 */
export function toPublicUserConfig(config: UserConfigData): UserConfigData {
  return {
    ...config,
    users: Object.fromEntries(
      Object.entries(config.users ?? {}).map(([id, { passphrase: _secret, ...rest }]) => [
        id,
        rest,
      ]),
    ),
  };
}

// Cache for user configuration
const userConfigCache = circleCache<UserConfigData>(60 * 1000); // 1 minute

/**
 * Get user configuration from S3
 */
export async function getUserConfig(): Promise<UserConfigData | null> {
  const cached = userConfigCache.get();
  if (cached) return cached;

  // Get from S3
  try {
    const config = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);

    if (config) userConfigCache.set(config);

    return config;
  } catch (err) {
    logger.error('Error loading user configuration', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Get user group for a specific user
 */
export async function getUserGroup(userId: string): Promise<string | undefined> {
  const config = await getUserConfig();
  return config?.users[userId]?.group;
}

/** Account ids that are playing right now: paused and remembered people sit out. */
async function playingAccounts(ids: string[]): Promise<string[]> {
  const family = await loadFamily();
  return ids.filter((id) => accountIsPlaying(family, id));
}

/**
 * Players in a group who are playing right now
 */
export async function getUsersInGroup(groupId: string): Promise<string[]> {
  logger.debug('Fetching users for group', { groupId });

  const config = await getUserConfig();

  if (!config) {
    logger.warn('No user configuration found when fetching users for group', { groupId });
    return [];
  }

  const usersInGroup = await playingAccounts(
    Object.entries(config.users)
      .filter(([, userData]) => userData.group === groupId)
      .map(([userId]) => userId),
  );

  logger.debug('Found users in group', {
    groupId,
    userCount: usersInGroup.length,
    users: usersInGroup.join(', '),
  });

  return usersInGroup;
}

/**
 * Get all unique group IDs
 */
export async function getAllGroups(): Promise<string[]> {
  const config = await getUserConfig();

  if (!config) return [];

  const playing = new Set(await playingAccounts(Object.keys(config.users)));
  return Array.from(
    new Set(
      Object.entries(config.users)
        .filter(([id]) => playing.has(id))
        .map(([, userData]) => userData.group),
    ),
  );
}

/**
 * Invalidate the user config cache. Call after admin writes.
 */
export function invalidateUserConfigCache(): void {
  userConfigCache.clear();
  logger.info('User config cache invalidated');
}

/**
 * Check whether a userId has the isAdmin flag
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const config = await getUserConfig();
  return !!(config?.users[userId] as UserConfig | undefined)?.isAdmin;
}

/**
 * Players who are playing right now. Everything that ranks, rotates or
 * notifies uses this; admin and sign-in read every account directly.
 */
export async function getAllUsers(): Promise<string[]> {
  const config = await getUserConfig();

  if (!config) return [];

  return playingAccounts(Object.keys(config.users));
}
