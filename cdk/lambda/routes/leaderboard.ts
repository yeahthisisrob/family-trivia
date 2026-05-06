// File: lambda/routes/leaderboard.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { getAllUsers, getUsersInGroup, getAllGroups } from '../services/users';
import { logger } from '../services/logger';
import { getAllCasinoRushSessions } from './game-modes/casinoRushUtils';
import { HistoryEntry, LeaderboardEntry, computePoints } from '../services/scoring';

/**
 * Get casino rush history for a user
 */
async function getCasinoRushHistory(userId: string): Promise<HistoryEntry[]> {
  const historyEntries: HistoryEntry[] = [];
  
  try {
    // Get all sessions using utility (checks both old and new paths)
    const sessions = await getAllCasinoRushSessions(userId);
    
    // Process each session
    for (const session of sessions) {
      if (!session || !session.questions) continue;
      
      // Casino Rush only awards points if ALL questions are correct (status = 'completed')
      const isCompleted = session.status === 'completed';
      const allCorrect = session.questions.every((q: any) => q.correct === true);
      const totalSessionPoints = isCompleted && allCorrect && session.potentialPoints ? session.potentialPoints : 0;
      // Divide points evenly among questions to avoid triple counting
      const pointsPerQuestion = totalSessionPoints > 0 ? totalSessionPoints / session.questions.length : 0;
      
      // Process each question in the session (same logic as userProfile)
      session.questions.forEach((q: any, index: number) => {
        if (q.userAnswer !== undefined) {
          historyEntries.push({
            question: {
              ...q,
              mode: 'casino-rush',
              pointMultiplier: 3
            },
            selectedAnswer: q.userAnswer,
            correct: q.correct || false,
            timestamp: new Date(q.answeredAt || session.lastPlayedAt || Date.now()).toISOString(),
            pointsEarned: q.correct && isCompleted && allCorrect ? pointsPerQuestion : 0,
            isCasinoRush: true,
            questionNumber: index + 1,
            totalQuestions: session.questions.length
          });
        }
      });
    }
    
  } catch (error) {
    logger.debug(`No Casino Rush history for user ${userId} or error reading it`);
  }
  
  return historyEntries;
}

/**
 * Compute leaderboard entries for a list of userIds
 */
async function computeLeaderboard(ids: string[]): Promise<LeaderboardEntry[]> {
  const entries = await Promise.all(
    ids.map(async (userId) => {
      const historyKey = `answers/history/${userId}.json`;
      const regularHistory = (await getJson<HistoryEntry[]>(historyKey)) || [];
      const casinoHistory = await getCasinoRushHistory(userId);
      const history = [...regularHistory, ...casinoHistory];

      let weightedScore = 0;
      let correctCount = 0;
      let totalPoints = 0;
      const difficultyStats = { easy: 0, normal: 0, hard: 0, total: history.length };
      const categoryScores: Record<string, number> = {};

      for (const h of history) {
        const diff = (h.question.difficulty || 'normal').toLowerCase() as 'easy' | 'normal' | 'hard';
        difficultyStats[diff]++;
        if (h.correct) {
          const points = computePoints(h);
          weightedScore += points;
          totalPoints += points;
          correctCount++;
          if (h.question.category) {
            categoryScores[h.question.category] = (categoryScores[h.question.category] || 0) + points;
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
      // No special handling needed for casino rush in leaderboard

      return {
        userId,
        score: weightedScore,
        streak,
        lastAnswer,
        categoryScores: Object.keys(categoryScores).length ? categoryScores : undefined,
        difficultyStats: history.length ? difficultyStats : undefined,
        avgPointsPerQuestion,
      };
    })
  );

  entries.sort((a, b) => b.score - a.score);
  return entries;
}

export async function leaderboard(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const groupId = event.queryStringParameters?.groupId || 'all';
    logger.info(`Computing leaderboard for group: ${groupId}`);

    if (groupId === 'all') {
      const allUsers = await getAllUsers();
      logger.debug(`Got ${allUsers.length} total users across all groups`);
      
      const groups = await getAllGroups();
      logger.debug(`Got ${groups.length} groups: ${groups.join(', ')}`);
      
      const result: Record<string, LeaderboardEntry[]> = {};

      result['all'] = await computeLeaderboard(allUsers);
      logger.debug(`Computed global leaderboard with ${result['all'].length} entries`);

      await Promise.all(
        groups.map(async (grp) => {
          const members = await getUsersInGroup(grp);
          result[grp] = await computeLeaderboard(members);
          logger.debug(`Computed group '${grp}' leaderboard with ${result[grp].length} entries`);
        })
      );

      return successResponse(result);
    }

    const members = await getUsersInGroup(groupId);
    logger.debug(`Computing leaderboard for ${members.length} members in group ${groupId}`);
    
    const board = await computeLeaderboard(members);
    logger.debug(`Leaderboard complete with ${board.length} entries`);
    
    return successResponse(board);
  } catch (error) {
    logger.error('Error generating leaderboard', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return errorResponse('Internal server error', 500);
  }
}
