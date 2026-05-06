// Module: leaderboard
// All leaderboard functions (basic, enhanced, group, consolidated)

import { getUserProfile, QuestionHistory } from './user';
import {
  computePoints,
  type LeaderboardEntry as LeaderboardUtilEntry,
  type GroupScore as GroupLeaderboardUtilEntry,
} from '../../components/Leaderboard/utils';
import { apiService } from '../../services/ApiService';
import { cacheService } from '../../services/CacheService';
import { getUserGroup } from '../../utils';
import { createLogger } from '../../utils/logger';

import type {
  LeaderboardEntry,
  GroupLeaderboardEntry,
  HistoryEntry,
  FactItem,
  SeasonInfo,
} from '@family-trivia/shared';

export type { LeaderboardEntry, GroupLeaderboardEntry, SeasonInfo } from '@family-trivia/shared';

// Initialize logger
const logger = createLogger('LeaderboardAPI');

/** Keys allowed for difficultyStats */
type DifficultyKeys = 'easy' | 'normal' | 'hard';

// ─── Basic Leaderboard ───────────────────────────────────────────────

/**
 * Fetch the raw leaderboard for a group.
 * Modified to always return all data when called with any groupId.
 */
export async function getLeaderboard(
  _groupId: string,
): Promise<Record<string, Array<{ userId: string; score: number; streak: number }>>> {
  try {
    // Always request 'all' to get complete data for all groups and members
    return await apiService.request<
      Record<string, Array<{ userId: string; score: number; streak: number }>>
    >(`/leaderboard?groupId=all`, { method: 'GET' }, `leaderboard_all`);
  } catch (error) {
    logger.error('Failed to fetch leaderboard', { error });
    return { all: [] };
  }
}

/**
 * Fetch enhanced leaderboard with history, category and difficulty breakdowns.
 * Modified to use 'all' data and then filter if needed.
 */
export async function getEnhancedLeaderboard(groupId: string): Promise<LeaderboardEntry[]> {
  try {
    const cacheKey = `enhanced_leaderboard_${groupId}`;
    const cached = cacheService.get<LeaderboardEntry[]>(cacheKey);
    if (cached) return cached;

    // Get all data with all groups
    const allData = await getLeaderboard('all');

    // Use the appropriate group's data or all data
    const basic = groupId !== 'all' && allData[groupId] ? allData[groupId] : allData['all'];

    if (!basic) return [];

    const enhanced = await Promise.all(
      basic.map(async (entry) => {
        try {
          const { history } = await getUserProfile(entry.userId);
          const categoryScores: Record<string, number> = {};
          const difficultyStats = { easy: 0, normal: 0, hard: 0, total: 0 };
          let totalPoints = 0;
          let count = 0;

          history.forEach((h: QuestionHistory) => {
            // Track difficulty stats regardless of correctness
            const diff = h.question.difficulty || 'normal';
            difficultyStats[diff] += 1;
            difficultyStats.total += 1;

            if (h.correct) {
              // Calculate points using the same logic as backend and utils
              const points = computePoints(h);
              totalPoints += points;
              count++;

              if (h.question.category) {
                categoryScores[h.question.category] =
                  (categoryScores[h.question.category] || 0) + points;
              }
            }
          });

          const avgPoints = count > 0 ? totalPoints / count : undefined;
          const lastAnswer = history.length ? history[history.length - 1] : undefined;

          return {
            ...entry,
            lastAnswer,
            categoryScores: Object.keys(categoryScores).length ? categoryScores : undefined,
            difficultyStats,
            avgPointsPerQuestion: avgPoints,
          };
        } catch (err) {
          logger.error('Error enhancing leaderboard entry', { userId: entry.userId, err });
          return entry as LeaderboardEntry;
        }
      }),
    );

    cacheService.set(cacheKey, enhanced);
    return enhanced;
  } catch (error) {
    logger.error('Failed to fetch enhanced leaderboard:', error);
    return [];
  }
}

/**
 * Fetch aggregated group-level leaderboard entries.
 * Always returns all groups.
 */
export async function getGroupLeaderboard(_allGroupId = 'all'): Promise<GroupLeaderboardEntry[]> {
  try {
    const cacheKey = 'group_leaderboard';
    const cached = cacheService.get<GroupLeaderboardEntry[]>(cacheKey);
    if (cached) return cached;

    // Always use 'all' to get all entries across all groups
    const allEntries = await getEnhancedLeaderboard('all');
    const map = new Map<string, GroupLeaderboardEntry>();

    allEntries.forEach((e) => {
      const groupId = getUserGroup(e.userId);
      if (!groupId) return;

      if (!map.has(groupId)) {
        map.set(groupId, {
          groupId,
          totalScore: 0,
          memberCount: 0,
          topScorer: '',
          topScore: 0,
          averageScore: 0,
          categoryScores: {},
          difficultyStats: { easy: 0, normal: 0, hard: 0, total: 0 },
        });
      }

      const grp = map.get(groupId);
      if (!grp) return;
      grp.totalScore += e.score;
      grp.memberCount++;

      if (e.score > grp.topScore) {
        grp.topScore = e.score;
        grp.topScorer = e.userId;
      }

      if (e.categoryScores && grp.categoryScores) {
        Object.entries(e.categoryScores).forEach(([cat, sc]) => {
          if (grp.categoryScores) {
            grp.categoryScores[cat] = (grp.categoryScores[cat] || 0) + sc;
          }
        });
      }

      if (e.difficultyStats && grp.difficultyStats) {
        const difficultyKeys: DifficultyKeys[] = ['easy', 'normal', 'hard'];
        difficultyKeys.forEach((level) => {
          if (grp.difficultyStats && e.difficultyStats) {
            grp.difficultyStats[level] += e.difficultyStats[level];
          }
        });
        if (grp.difficultyStats) {
          grp.difficultyStats.total += e.difficultyStats.total;
        }
      }
    });

    const result = Array.from(map.values()).map((grp) => {
      grp.averageScore = grp.memberCount ? grp.totalScore / grp.memberCount : 0;
      if (grp.difficultyStats) {
        const { easy, normal, hard } = grp.difficultyStats;
        grp.difficultyStats.dominant =
          easy >= normal && easy >= hard
            ? 'easy'
            : normal >= easy && normal >= hard
              ? 'normal'
              : 'hard';
      }
      return grp;
    });

    result.sort((a, b) => b.totalScore - a.totalScore);
    cacheService.set(cacheKey, result);
    return result;
  } catch (error) {
    logger.error('Failed to fetch group leaderboard', { error });
    return [];
  }
}

// ─── Consolidated Leaderboard ────────────────────────────────────────

interface UserData {
  leaderboardEntry: LeaderboardUtilEntry;
  history: HistoryEntry[];
  facts: FactItem[];
  group?: string;
}

interface ConsolidatedLeaderboardData {
  users: Record<string, UserData>;
  groups: Record<string, GroupLeaderboardUtilEntry>;
  userGroups?: Record<string, string>;
  seasons?: SeasonInfo[];
  selectedSeason?: number;
  maxQuestionsAsked?: number;
  globalCategoryStats?: Record<string, { total: number; correct: number }>;
  success: boolean;
}

/**
 * Fetch the consolidated leaderboard data in a single API call
 * This provides all users' leaderboard data, their history, and facts,
 * as well as aggregated group data in a single request
 */
export async function getConsolidatedLeaderboard(
  season?: number,
): Promise<ConsolidatedLeaderboardData> {
  try {
    // Check cache first (include season in cache key)
    const cacheKey =
      season != null ? `consolidated_leaderboard_s${season}` : 'consolidated_leaderboard';
    const cached = cacheService.get<ConsolidatedLeaderboardData>(cacheKey);
    if (cached) return cached;

    // Build URL with optional season param
    const url =
      season != null ? `/consolidated-leaderboard?season=${season}` : '/consolidated-leaderboard';

    // Fetch from API with an extended timeout since this is a complex operation
    const response = await apiService.request<ConsolidatedLeaderboardData>(
      url,
      { method: 'GET' },
      cacheKey,
      false, // Don't force fresh request
      30000, // 30 second timeout
    );

    if (response.success) {
      cacheService.set(cacheKey, response);
      return response;
    }

    return {
      users: {},
      groups: {},
      success: false,
    };
  } catch (error) {
    logger.error('Failed to fetch consolidated leaderboard:', error);
    return {
      users: {},
      groups: {},
      success: false,
    };
  }
}

/**
 * Get user data for a specific user
 */
export async function getUserData(userId: string): Promise<UserData | null> {
  try {
    const data = await getConsolidatedLeaderboard();
    return data.users[userId] || null;
  } catch (error) {
    logger.error(`Failed to get user data for ${userId}:`, error);
    return null;
  }
}

/**
 * Get leaderboard entries for all users
 */
export async function getAllLeaderboardEntries(): Promise<LeaderboardUtilEntry[]> {
  try {
    const data = await getConsolidatedLeaderboard();
    return Object.values(data.users)
      .map((user) => user.leaderboardEntry)
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    logger.error('Failed to get all leaderboard entries:', error);
    return [];
  }
}

/**
 * Get group leaderboard entries
 */
export async function getAllGroupEntries(): Promise<GroupLeaderboardUtilEntry[]> {
  try {
    const data = await getConsolidatedLeaderboard();
    return Object.values(data.groups).sort((a, b) => b.totalScore - a.totalScore);
  } catch (error) {
    logger.error('Failed to get all group entries:', error);
    return [];
  }
}

/**
 * Import this method to access the consolidated API
 * for the Leaderboard component
 */
export async function getOptimizedLeaderboardData(season?: number): Promise<{
  players: LeaderboardUtilEntry[];
  groups: GroupLeaderboardUtilEntry[];
  userGroups: Record<string, string>;
  seasons: SeasonInfo[];
  selectedSeason?: number;
  maxQuestionsAsked?: number;
  globalCategoryStats?: Record<string, { total: number; correct: number }>;
}> {
  try {
    // Use a single API call to avoid partial data issues
    const data = await getConsolidatedLeaderboard(season);

    if (!data || !data.success) {
      logger.warn('Failed to get consolidated leaderboard or received unsuccessful response');
      return { players: [], groups: [], userGroups: {}, seasons: [] };
    }

    // Process and sort the data
    const players = Object.values(data.users)
      .filter((user) => user && user.leaderboardEntry)
      .map((user) => user.leaderboardEntry)
      .sort((a, b) => b.score - a.score);

    const groups = Object.values(data.groups)
      .filter((group) => group && group.groupId && group.memberCount > 0)
      .sort((a, b) => b.totalScore - a.totalScore);

    return {
      players,
      groups,
      userGroups: data.userGroups || {},
      seasons: data.seasons || [],
      selectedSeason: data.selectedSeason,
      maxQuestionsAsked: data.maxQuestionsAsked,
      globalCategoryStats: data.globalCategoryStats,
    };
  } catch (error) {
    logger.error('Error in getOptimizedLeaderboardData', { error });
    return { players: [], groups: [], userGroups: {}, seasons: [] };
  }
}
