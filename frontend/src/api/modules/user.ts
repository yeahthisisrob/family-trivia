// Module: user
// User config and profile

import type { HistoryEntry, UserConfigResponse, UserProfile } from '@family-trivia/shared';
import { apiService } from '../../shared/api/ApiService';
import { identityColor } from '../../shared/design-system';
import { createLogger } from '../../shared/lib/logger';

// ── Type re-exports ────────────────────────────────────────────────

export type {
  BasicQA,
  CategorySelection,
  DifficultyStats,
  MemberInsight,
  ScoreHistoryEntry,
  UserConfig,
  UserConfigResponse,
  UserProfile,
} from '@family-trivia/shared';

/**
 * Re-export HistoryEntry as QuestionHistory for backward compatibility.
 * The frontend historically used "QuestionHistory" while the shared package uses "HistoryEntry".
 */
export type QuestionHistory = HistoryEntry;

// ── Logger ─────────────────────────────────────────────────────────

const logger = createLogger('ProfileAPI');

// ── User Config ────────────────────────────────────────────────────

/**
 * Fetch user configuration from the backend
 */
export async function getUserConfig(): Promise<UserConfigResponse> {
  return apiService.request<UserConfigResponse>(
    '/user-config',
    {
      method: 'GET',
    },
    'user-config',
    false,
  );
}

/**
 * Get user group based on userId
 */
export function getUserGroup(userConfig: UserConfigResponse, userId: string): string | undefined {
  return userConfig.users[userId]?.group;
}

/**
 * Get user color: the one set in config, else the person's identity color.
 */
export function getUserColor(userConfig: UserConfigResponse, userId: string): string {
  return userConfig.users[userId]?.color || identityColor(userId);
}

// ── Profile ────────────────────────────────────────────────────────

/**
 * Fetch a user's full profile, including history, streak, facts,
 * category selections, and difficulty breakdown.
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  // Profile reads it as server data (entities/person); the Trivia tab and the
  // leaderboard ask here, uncached, until they move too (docs/decisions/0035).
  try {
    return await apiService.request<UserProfile>(
      `/user-profile?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
    );
  } catch (error) {
    logger.error('Failed to get user profile, returning empty profile:', error);
    return {
      profile: {},
      history: [],
      streak: 0,
      facts: [],
      categorySelections: [],
      difficultyStats: { easy: 0, normal: 0, hard: 0, total: 0 },
      totalScore: 0,
      lastUpdated: new Date().toISOString(),
    };
  }
}
