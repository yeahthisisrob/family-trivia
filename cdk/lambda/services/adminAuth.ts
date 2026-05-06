// File: lambda/services/adminAuth.ts
// Purpose: Admin authentication helper

import { getUserConfig } from './users';
import { logger } from './logger';

/**
 * Validates that the requesting user is an admin.
 * @param userId The user ID to check
 * @returns Error message string if not authorized, null if authorized
 */
export async function requireAdmin(userId: string | undefined | null): Promise<string | null> {
  if (!userId) {
    return 'Missing userId — admin access requires authentication';
  }

  const config = await getUserConfig();
  if (!config) {
    logger.error('Could not load user config for admin check', { userId });
    return 'Unable to verify admin status — config unavailable';
  }

  const user = config.users[userId];
  if (!user) {
    logger.warn('Admin check failed — user not found', { userId });
    return 'User not found';
  }

  if (!(user as any).isAdmin) {
    logger.warn('Admin check failed — user is not an admin', { userId });
    return 'Forbidden — admin access required';
  }

  logger.info('Admin access granted', { userId });
  return null;
}
