// File: lambda/routes/leaderboard.ts
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../config';
import { olderAnswersOf } from '../services/gameRegistry';
import { logger } from '../services/logger';
import { getJson } from '../services/s3';
import { computePoints, type HistoryEntry, type LeaderboardEntry } from '../services/scoring';
import { getAllUsers, getEveryAccount, getEveryGroup, getEveryoneInGroup } from '../services/users';

/**
 * Compute leaderboard entries for a list of userIds. Everyone with answers
 * keeps a row, remembered and paused people included; someone not playing
 * now with nothing to show is left off.
 */
async function computeLeaderboard(
  ids: string[],
  playing: Set<string>,
): Promise<LeaderboardEntry[]> {
  const rows = await Promise.all(
    ids.map(async (userId) => {
      const historyKey = `answers/history/${userId}.json`;
      const regularHistory = (await getJson<HistoryEntry[]>(historyKey)) || [];
      // Plus answers the games keep in their own files (older plays).
      const history = [...regularHistory, ...(await olderAnswersOf(userId))];

      let weightedScore = 0;
      let correctCount = 0;
      let totalPoints = 0;
      const difficultyStats = { easy: 0, normal: 0, hard: 0, total: history.length };
      const categoryScores: Record<string, number> = {};

      for (const h of history) {
        const diff = (h.question.difficulty || 'normal').toLowerCase() as
          | 'easy'
          | 'normal'
          | 'hard';
        difficultyStats[diff]++;
        if (h.correct) {
          const points = computePoints(h);
          weightedScore += points;
          totalPoints += points;
          correctCount++;
          if (h.question.category) {
            categoryScores[h.question.category] =
              (categoryScores[h.question.category] || 0) + points;
          }
        }
      }

      const avgPointsPerQuestion = correctCount > 0 ? totalPoints / correctCount : undefined;
      // Compute streak from answer history: consecutive correct answers at end
      let streak = 0;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].correct) streak++;
        else break;
      }
      const lastAnswer = history.length ? history[history.length - 1] : undefined;

      if (!history.length && !playing.has(userId)) return null;
      return {
        userId,
        score: weightedScore,
        streak,
        lastAnswer,
        categoryScores: Object.keys(categoryScores).length ? categoryScores : undefined,
        difficultyStats: history.length ? difficultyStats : undefined,
        avgPointsPerQuestion,
      };
    }),
  );

  const entries = rows.filter((e) => e !== null);
  entries.sort((a, b) => b.score - a.score);
  return entries;
}

export async function leaderboard(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const groupId = event.queryStringParameters?.groupId || 'all';
    logger.info(`Computing leaderboard for group: ${groupId}`);

    const playing = new Set(await getAllUsers());

    if (groupId === 'all') {
      const allUsers = await getEveryAccount();
      logger.debug(`Got ${allUsers.length} total users across all groups`);

      const groups = await getEveryGroup();
      logger.debug(`Got ${groups.length} groups: ${groups.join(', ')}`);

      const result: Record<string, LeaderboardEntry[]> = {};

      result.all = await computeLeaderboard(allUsers, playing);
      logger.debug(`Computed global leaderboard with ${result.all.length} entries`);

      await Promise.all(
        groups.map(async (grp) => {
          const members = await getEveryoneInGroup(grp);
          result[grp] = await computeLeaderboard(members, playing);
          logger.debug(`Computed group '${grp}' leaderboard with ${result[grp].length} entries`);
        }),
      );

      return successResponse(result);
    }

    const members = await getEveryoneInGroup(groupId);
    logger.debug(`Computing leaderboard for ${members.length} members in group ${groupId}`);

    const board = await computeLeaderboard(members, playing);
    logger.debug(`Leaderboard complete with ${board.length} entries`);

    return successResponse(board);
  } catch (error) {
    logger.error('Error generating leaderboard', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse('Internal server error', 500);
  }
}
