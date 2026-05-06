// Module: user
// User config, profile, history, and member summaries

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

import type { HistoryEntry, UserConfigResponse, UserProfile, MemberSummaryResponse } from '@family-trivia/shared';

// ── Type re-exports ────────────────────────────────────────────────

export type { UserConfig, UserConfigResponse } from '@family-trivia/shared';
export type { FactItem, CategorySelection, DifficultyStats, ScoreHistoryEntry, UserProfile } from '@family-trivia/shared';
export type { BasicQA, MemberInsight, MemberSummaryResponse } from '@family-trivia/shared';

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
 * Get user color based on userId
 */
export function getUserColor(userConfig: UserConfigResponse, userId: string): string {
  // If user exists in config, return their color
  if (userConfig.users[userId]?.color) {
    return userConfig.users[userId].color;
  }

  // Fallback to the original algorithm if user not found in config
  const USER_COLORS = ['#FF5722', '#4CAF50', '#2196F3', '#9C27B0', '#FFC107', '#E91E63', '#00BCD4'];

  const idx =
    userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % USER_COLORS.length;
  return USER_COLORS[idx];
}

// ── Profile ────────────────────────────────────────────────────────

/**
 * Fetch a user's full profile, including history, streak, facts,
 * category selections, and difficulty breakdown.
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    return await apiService.request<UserProfile>(
      `/user-profile?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
      `user_profile_${userId}`,
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

/**
 * Convenience wrapper to return just the question history.
 */
export async function getUserHistory(userId: string): Promise<QuestionHistory[]> {
  try {
    const { history } = await getUserProfile(userId);
    return history;
  } catch (error) {
    logger.error('Failed to get user history, returning empty array:', error);
    return [];
  }
}

// ── Member Summary ─────────────────────────────────────────────────

/**
 * Get an AI-generated summary for a family member
 *
 * @param userId The user ID to get a summary for
 * @param mode Whether to get a regular or roast summary
 * @param forceGenerate Whether to force generation of a new summary
 * @returns The member summary
 */
export async function getMemberSummary(
  userId: string,
  mode: 'regular' | 'roast' = 'regular',
  forceGenerate = false,
): Promise<MemberSummaryResponse> {
  // Create a cache key for this request
  const cacheKey = forceGenerate ? undefined : `member_summary_${userId}_${mode}`;

  // Construct the URL with query parameters
  const url = `/member-summary?userId=${encodeURIComponent(userId)}&mode=${mode}${forceGenerate ? '&forceGenerate=true' : ''}`;

  // Make the request using the standard apiService
  return apiService.request<MemberSummaryResponse>(
    url,
    { method: 'GET' },
    cacheKey,
    forceGenerate, // Pass forceFresh parameter
  );
}
