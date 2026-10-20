/**
 * The categories a game's trivia question can come from: the circle's own
 * categories and the player's custom ones, or the defaults when there are
 * none. Shared by the games that ask questions (rounds and the session games).
 */
import { DEFAULT_CATEGORIES } from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { logger } from '../../services/logger';
import { getJson } from '../../services/s3';

/** Every category for the player: the circle's, then their custom ones. */
export async function getAvailableCategories(userId: string): Promise<string[]> {
  try {
    logger.info('Fetching categories for user', {
      userId,
      systemPath: S3_PATHS.CATEGORIES,
      userPath: S3_PATHS.USER_CATEGORIES(userId),
    });

    let systemCategories: any[] = [];
    let userCategories: any[] = [];

    try {
      systemCategories = (await getJson<any[]>(S3_PATHS.CATEGORIES)) || [];
      logger.info('System categories loaded', {
        count: systemCategories.length,
        categories: systemCategories.slice(0, 3), // Log first 3 for debugging
      });
    } catch (err) {
      logger.warn('Failed to load system categories', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }

    try {
      userCategories = (await getJson<any[]>(S3_PATHS.USER_CATEGORIES(userId))) || [];
      logger.info('User categories loaded', {
        count: userCategories.length,
        categories: userCategories.slice(0, 3), // Log first 3 for debugging
      });
    } catch {
      logger.info('No custom categories for user', { userId });
    }

    const allCategories = [
      ...systemCategories.map((c) => c.name),
      ...userCategories.map((c) => `Custom: ${c.title}`),
    ];

    // If no categories found, use default categories as fallback
    if (allCategories.length === 0) {
      logger.warn('No categories found in S3, using default categories', { userId });
      return DEFAULT_CATEGORIES.map((c) => c.name);
    }

    logger.info('Available categories for user', {
      userId,
      systemCount: systemCategories.length,
      customCount: userCategories.length,
      totalCount: allCategories.length,
      allCategories: allCategories,
    });

    return allCategories;
  } catch (error) {
    logger.error('Error getting available categories', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return empty array as fallback
    return [];
  }
}
