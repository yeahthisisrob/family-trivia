// Module: user
// User config

import type { UserConfigResponse } from '@family-trivia/shared';
import { apiService } from '../../shared/api/ApiService';
import { identityColor } from '../../shared/design-system';

// ── Type re-exports ────────────────────────────────────────────────

export type {
  BasicQA,
  DifficultyStats,
  MemberInsight,
  ScoreHistoryEntry,
  UserConfig,
  UserConfigResponse,
} from '@family-trivia/shared';

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
