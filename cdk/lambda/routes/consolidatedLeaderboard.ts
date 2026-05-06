// File: lambda/routes/consolidatedLeaderboard.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { getAllUsers, getUsersInGroup, getAllGroups } from '../services/users';
import { logger } from '../services/logger';
import { S3_PATHS } from '../constants';
import { getRecentRounds } from '../services/familyFeudService';
import { HistoryEntry, LeaderboardEntry, computePoints } from '../services/scoring';
import { getSeasonsConfig } from '../services/seasonService';
import { getHighScores } from '../services/arcadeService';
import type { ArcadeGameId, PointBreakdown } from '@family-trivia/shared';
import { getAllPlayerState } from '../services/playerStateService';
import { toQuestionSlots } from '../services/questionSlotService';
import { GroupLeaderboardEntry as SharedGroupLeaderboardEntry } from '@family-trivia/shared';

/** Backend-specific group description (stored in S3, differs from shared GroupDescription) */
interface GroupDescription {
  description: string;
  lastUpdated: string;
  updatedBy?: string;
}

/** Extended group leaderboard entry with backend-specific fields */
interface GroupLeaderboardEntry extends SharedGroupLeaderboardEntry {
  activeMemberCount?: number;
  accuracy?: number;
  description?: GroupDescription;
}

interface SeasonDateFilter {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface ConsolidatedLeaderboardData {
  users: Record<string, {
    leaderboardEntry: LeaderboardEntry;
    history: HistoryEntry[];
    facts: any[];
    group?: string;
  }>;
  groups: Record<string, GroupLeaderboardEntry>;
  userGroups: Record<string, string>;
  seasons?: Array<{ seasonNumber: number; name: string; startDate: string; endDate: string | null; status: string }>;
  selectedSeason?: number;
  maxQuestionsAsked?: number;
  /** Aggregated category accuracy stats across all users (all-time) */
  globalCategoryStats?: Record<string, { total: number; correct: number }>;
  success: boolean;
}

/**
 * Filter history entries to those within a season's date range.
 */
function filterHistoryBySeason(history: HistoryEntry[], filter: SeasonDateFilter): HistoryEntry[] {
  const startMs = new Date(filter.startDate + 'T00:00:00Z').getTime();
  // endDate is inclusive — include entries up to end of day
  const endMs = new Date(filter.endDate + 'T23:59:59.999Z').getTime();
  return history.filter(h => {
    const ts = new Date(h.timestamp).getTime();
    return ts >= startMs && ts <= endMs;
  });
}

/**
 * Compute leaderboard entries for a list of userIds
 */
/**
 * Compute leaderboard entries using playerStateService for slots/streak/score
 * and doing its own category/difficulty/Family Feud breakdowns (leaderboard-specific).
 */
async function computeLeaderboard(ids: string[], seasonFilter?: SeasonDateFilter, arcadeBonusMap?: Map<string, number>): Promise<Record<string, {
  leaderboardEntry: LeaderboardEntry;
  history: HistoryEntry[];
  allHistory: HistoryEntry[];
  facts: any[];
  group?: string;
}>> {
  // Get all player state from the single source of truth
  const allState = await getAllPlayerState();

  // Load Family Feud rounds once (leaderboard-specific)
  let feudRounds: any[] = [];
  try { feudRounds = await getRecentRounds(100); } catch { /* may not exist */ }

  const result: Record<string, {
    leaderboardEntry: LeaderboardEntry;
    history: HistoryEntry[];
    allHistory: HistoryEntry[];
    facts: any[];
    group?: string;
  }> = {};

  for (const userId of ids) {
    const state = allState.get(userId);
    if (!state) continue;

    const allHistory = state.history;
    const history = seasonFilter ? filterHistoryBySeason(allHistory, seasonFilter) : allHistory;

    // Category & difficulty breakdowns (leaderboard-specific, not in playerState)
    let correctCount = 0;
    const difficultyStats = { easy: 0, normal: 0, hard: 0, total: 0 };
    const categoryScores: Record<string, number> = {};

    for (const h of history) {
      const diff = (h.question.difficulty || 'normal').toLowerCase() as 'easy' | 'normal' | 'hard';
      // Casino sub-questions: only count the session once for difficulty
      if (h.isCasinoRush && h.casinoSessionId) {
        // Only count first entry per session for difficulty stats
        const isFirst = history.indexOf(h) === history.findIndex(
          e => e.isCasinoRush && e.casinoSessionId === h.casinoSessionId,
        );
        if (isFirst) {
          difficultyStats[diff]++;
          difficultyStats.total++;
          const session = history.filter(e => e.isCasinoRush && e.casinoSessionId === h.casinoSessionId);
          if (session.every(e => e.correct)) correctCount++;
        }
      } else {
        difficultyStats[diff]++;
        difficultyStats.total++;
        if (h.correct) correctCount++;
      }

      // Category scores: all correct entries earn points
      if (h.correct) {
        const points = computePoints(h);
        if (h.question.category) {
          categoryScores[h.question.category] = (categoryScores[h.question.category] || 0) + points;
        }
      }
    }

    // Family Feud points (leaderboard-specific)
    let feudPoints = 0;
    for (const round of feudRounds) {
      if (round.results?.winners) {
        for (const winner of round.results.winners) {
          if (winner.userId === userId) {
            if (seasonFilter) {
              const roundDate = round.startedAt?.split('T')[0];
              if (roundDate && roundDate >= seasonFilter.startDate && roundDate <= seasonFilter.endDate) {
                feudPoints += winner.points;
              }
            } else {
              feudPoints += winner.points;
            }
          }
        }
      }
    }

    // Score & slots: use playerState for unfiltered, compute from history when season-filtered
    // Split points into regular vs game-mode
    let regularPoints = 0;
    let gameModePoints = 0;
    for (const h of history) {
      if (h.correct) {
        const pts = computePoints(h);
        const isGameMode = h.isCasinoRush || h.isSlotMachine || h.isCurling || h.isTetris;
        if (isGameMode) {
          gameModePoints += pts;
        } else {
          regularPoints += pts;
        }
      }
    }
    const arcadeBonusPoints = arcadeBonusMap?.get(userId) ?? 0;
    const totalScore = regularPoints + gameModePoints + feudPoints + arcadeBonusPoints;

    const slots = toQuestionSlots(history);
    const questionsAnswered = slots.length;

    // Streak from filtered history
    let streak = 0;
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i].correct) streak++;
      else break;
    }

    const avgPointsPerQuestion = correctCount > 0 ? totalScore / correctCount : undefined;
    const accuracy = questionsAnswered > 0 ? Math.round((correctCount / questionsAnswered) * 100) : undefined;

    const sortedHistory = [...history].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    const lastAnswer = sortedHistory.length ? sortedHistory[sortedHistory.length - 1] : undefined;

    const pointBreakdown: PointBreakdown = {
      regularPoints,
      gameModePoints,
      arcadeBonusPoints,
      familyFeudPoints: feudPoints,
    };

    result[userId] = {
      leaderboardEntry: {
        userId,
        score: totalScore,
        streak,
        lastAnswer,
        categoryScores: Object.keys(categoryScores).length ? categoryScores : undefined,
        difficultyStats: questionsAnswered > 0 ? difficultyStats : undefined,
        avgPointsPerQuestion,
        accuracy,
        questionsAnswered,
        pointBreakdown,
      },
      history,
      allHistory,
      facts: [],
    };
  }

  return result;
}


/**
 * Endpoint that provides comprehensive leaderboard data in a single request
 * Includes:
 * 1. Individual user leaderboard entries
 * 2. User answer histories
 * 3. Group leaderboard data
 */
export async function getConsolidatedLeaderboard(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  logger.info('Starting consolidated leaderboard request');
  try {
    // Parse optional season filter
    const seasonParam = event.queryStringParameters?.season;
    let seasonFilter: SeasonDateFilter | undefined;
    let selectedSeason: number | undefined;

    // Load seasons config (needed for response + filtering)
    const seasonsConfig = await getSeasonsConfig();
    const seasonsForResponse = seasonsConfig.seasons.map(s => ({
      seasonNumber: s.seasonNumber,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
    }));

    if (seasonParam) {
      const seasonNum = parseInt(seasonParam, 10);
      if (!isNaN(seasonNum)) {
        const season = seasonsConfig.seasons.find(s => s.seasonNumber === seasonNum);
        if (season && season.endDate) {
          seasonFilter = { startDate: season.startDate, endDate: season.endDate };
          selectedSeason = seasonNum;
          logger.info(`Filtering leaderboard for season ${seasonNum}: ${season.startDate} to ${season.endDate}`);
        } else if (season && !season.endDate) {
          // Active season with no end date — use today as end
          const today = new Date().toISOString().split('T')[0];
          seasonFilter = { startDate: season.startDate, endDate: today };
          selectedSeason = seasonNum;
          logger.info(`Filtering leaderboard for active season ${seasonNum}: ${season.startDate} to ${today}`);
        }
      }
    }

    // Get all users and groups
    const allUsers = await getAllUsers();
    logger.info(`Retrieved ${allUsers.length} users`);

    const allGroups = await getAllGroups();
    logger.info(`Retrieved ${allGroups.length} groups`);

    // Build user to group mapping
    const userGroups: Record<string, string> = {};
    for (const groupId of allGroups) {
      const groupUsers = await getUsersInGroup(groupId);
      for (const userId of groupUsers) {
        userGroups[userId] = groupId;
      }
    }

    // Fetch all group descriptions
    const groupDescriptions: Record<string, GroupDescription> = {};
    try {
      const descriptionsData = await getJson<Record<string, GroupDescription>>(S3_PATHS.GROUP_DESCRIPTIONS);
      if (descriptionsData) {
        Object.assign(groupDescriptions, descriptionsData);
        logger.info(`Loaded ${Object.keys(groupDescriptions).length} group descriptions`);
      }
    } catch (error) {
      logger.warn('Could not load group descriptions', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Compute arcade high score bonus points (Gold=3, Silver=2, Bronze=1)
    const ARCADE_GAMES: ArcadeGameId[] = ['tetris', 'curling', 'slot-machine'];
    const PLACEMENT_BONUS = [3, 2, 1]; // 1st, 2nd, 3rd
    const arcadeBonusMap = new Map<string, number>();

    try {
      const allScores = await Promise.all(ARCADE_GAMES.map(g => getHighScores(g)));
      for (const scores of allScores) {
        // scores are sorted highest first; award top 3 unique users
        const awarded = new Set<string>();
        let rank = 0;
        for (const entry of scores) {
          if (awarded.has(entry.userId)) continue;
          if (rank >= 3) break;
          const bonus = PLACEMENT_BONUS[rank];
          arcadeBonusMap.set(entry.userId, (arcadeBonusMap.get(entry.userId) ?? 0) + bonus);
          awarded.add(entry.userId);
          rank++;
        }
      }
      logger.info(`Computed arcade bonus for ${arcadeBonusMap.size} users`);
    } catch (err) {
      logger.warn('Could not compute arcade bonus points', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Compute leaderboard for all users (with optional season filter)
    const userLeaderboardData = await computeLeaderboard(allUsers, seasonFilter, arcadeBonusMap);
    
    // Calculate group leaderboard data
    const groupLeaderboardData: Record<string, GroupLeaderboardEntry> = {};
    
    // Track player activity for averaging (2 weeks = 10 days)
    const INACTIVITY_THRESHOLD_DAYS = 10;
    const now = new Date();
    const inactivityThreshold = new Date(now.getTime() - INACTIVITY_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    
    // Process groups in parallel to speed up calculation
    await Promise.all(allGroups.map(async (groupId) => {
      const groupUsers = await getUsersInGroup(groupId);
      let totalScore = 0;
      let memberCount = 0;
      let topScorer = '';
      let topScore = 0;
      const groupCategoryScores: Record<string, number> = {};
      const groupDifficultyStats = { easy: 0, normal: 0, hard: 0, total: 0 };
      
      // Calculate group aggregates
      let activeMemberCount = 0;
      let activeScore = 0;
      let groupTotalQuestions = 0;
      let groupCorrectAnswers = 0;
      
      for (const userId of groupUsers) {
        const userData = userLeaderboardData[userId];
        if (!userData) {
          continue;
        }

        const entry = userData.leaderboardEntry;
        const history = userData.history;
        
        // Check if player is active (has played in the last week)
        let isActive = false;
        let lastActivityDate: Date | null = null;
        
        try {
          // Try to get last activity from either history or lastAnswer
          if (history && history.length > 0) {
            // Sort history by timestamp to find the most recent activity
            const sortedHistory = [...history].sort((a, b) => 
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            const lastHistoryEntry = sortedHistory[0]; // Most recent is first after reverse sort
            
            if (lastHistoryEntry.timestamp) {
              lastActivityDate = new Date(lastHistoryEntry.timestamp);
            }
          }
          
          // Fall back to lastAnswer from leaderboard entry
          if (!lastActivityDate && entry.lastAnswer?.timestamp) {
            lastActivityDate = new Date(entry.lastAnswer.timestamp);
          }
          
          if (lastActivityDate && !isNaN(lastActivityDate.getTime())) {
            isActive = lastActivityDate >= inactivityThreshold;
          } else {
            // If we can't determine activity, consider them INACTIVE (not active)
            isActive = false;
          }
        } catch (error) {
          logger.error('Error checking activity for user', { 
            groupId,
            userId,
            error: error instanceof Error ? error.message : String(error)
          });
          // On error, consider them inactive
          isActive = false;
        }
        
        // Always count towards total score and member count
        totalScore += entry.score;
        memberCount++;
        
        // Only count active players for averaging
        if (isActive) {
          activeMemberCount++;
          activeScore += entry.score;
        }
        
        if (entry.score > topScore) {
          topScore = entry.score;
          topScorer = userId;
        }
        
        // Aggregate category scores (from all players)
        if (entry.categoryScores) {
          Object.entries(entry.categoryScores).forEach(([category, score]) => {
            groupCategoryScores[category] = (groupCategoryScores[category] || 0) + score;
          });
        }
        
        // Aggregate difficulty stats (from all players)
        if (entry.difficultyStats) {
          groupDifficultyStats.easy += entry.difficultyStats.easy;
          groupDifficultyStats.normal += entry.difficultyStats.normal;
          groupDifficultyStats.hard += entry.difficultyStats.hard;
          groupDifficultyStats.total += entry.difficultyStats.total;
        }
        
        // Aggregate questions and correct answers for group accuracy
        if (entry.difficultyStats && entry.accuracy !== undefined) {
          const totalQuestions = entry.difficultyStats.total;
          const correctAnswers = Math.round((entry.accuracy / 100) * totalQuestions);
          groupTotalQuestions += totalQuestions;
          groupCorrectAnswers += correctAnswers;
        }
      }
      
      // Calculate average score using only active players
      // Fall back to total average if no active members found
      const averageScore = activeMemberCount > 0 
        ? activeScore / activeMemberCount 
        : (memberCount > 0 ? totalScore / memberCount : 0);
      
      // Calculate group accuracy as total correct / total questions
      const groupAccuracy = groupTotalQuestions > 0 
        ? Math.round((groupCorrectAnswers / groupTotalQuestions) * 100) 
        : undefined;
      
      // Determine dominant difficulty
      let dominant: 'easy' | 'normal' | 'hard' = 'normal';
      if (groupDifficultyStats.easy >= groupDifficultyStats.normal && 
          groupDifficultyStats.easy >= groupDifficultyStats.hard) {
        dominant = 'easy';
      } else if (groupDifficultyStats.hard >= groupDifficultyStats.normal && 
                 groupDifficultyStats.hard >= groupDifficultyStats.easy) {
        dominant = 'hard';
      }
      
      groupLeaderboardData[groupId] = {
        groupId,
        totalScore,
        memberCount,
        activeMemberCount: activeMemberCount > 0 ? activeMemberCount : undefined,
        topScorer,
        topScore,
        averageScore,
        categoryScores: Object.keys(groupCategoryScores).length > 0 ? groupCategoryScores : undefined,
        difficultyStats: {
          ...groupDifficultyStats,
          dominant
        },
        accuracy: groupAccuracy,
        description: groupDescriptions[groupId] // Include the group description
      };
    }));
    
    // Add group information to user data
    for (const [userId, userData] of Object.entries(userLeaderboardData)) {
      if (userGroups[userId]) {
        userData.group = userGroups[userId];
      }
    }
    
    // maxQuestionsAsked = highest questionsAnswered across all users
    // This is the simplest proxy for "how many questions were available"
    // and self-corrects as users catch up.
    let maxQuestionsAsked = 0;
    for (const userData of Object.values(userLeaderboardData)) {
      const count = userData.leaderboardEntry.questionsAnswered ?? 0;
      if (count > maxQuestionsAsked) maxQuestionsAsked = count;
    }

    // Aggregate global category accuracy stats across all users (all-time, not season-filtered)
    const globalCategoryStats: Record<string, { total: number; correct: number }> = {};
    for (const userData of Object.values(userLeaderboardData)) {
      for (const h of userData.allHistory) {
        if (h.question.category) {
          const cat = h.question.category;
          if (!globalCategoryStats[cat]) globalCategoryStats[cat] = { total: 0, correct: 0 };
          globalCategoryStats[cat].total++;
          if (h.correct) globalCategoryStats[cat].correct++;
        }
      }
    }

    // Write category accuracy cache to S3 for submitAnswer bonus calculation
    try {
      await putJson(S3_PATHS.CATEGORY_ACCURACY_CACHE, globalCategoryStats);
    } catch (cacheErr) {
      logger.warn('Failed to write category accuracy cache', {
        error: cacheErr instanceof Error ? cacheErr.message : String(cacheErr),
      });
    }

    // Build final response — strip allHistory (internal only, not part of API response)
    const usersResponse: ConsolidatedLeaderboardData['users'] = {};
    for (const [userId, userData] of Object.entries(userLeaderboardData)) {
      usersResponse[userId] = {
        leaderboardEntry: userData.leaderboardEntry,
        history: userData.history,
        facts: userData.facts,
        ...(userData.group && { group: userData.group }),
      };
    }
    const response: ConsolidatedLeaderboardData = {
      users: usersResponse,
      groups: groupLeaderboardData,
      userGroups,
      seasons: seasonsForResponse,
      selectedSeason,
      maxQuestionsAsked: maxQuestionsAsked > 0 ? maxQuestionsAsked : undefined,
      globalCategoryStats: Object.keys(globalCategoryStats).length > 0 ? globalCategoryStats : undefined,
      success: true
    };
    
    return successResponse(response);
  } catch (error) {
    logger.error('Error fetching consolidated leaderboard data', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return errorResponse('Failed to retrieve leaderboard data', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}