// File: lambda/routes/userProfile.ts

import { gameModeOf, legacyFlagsOf, playOf } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../config';
import { getFactHistory } from '../services/factHistoryService';
import { olderAnswersOf, serverGame } from '../services/gameRegistry';
import { logger } from '../services/logger';
import { getJson } from '../services/s3';

interface FactItem {
  id: string;
  date: string;
  question: string;
  answer: string;
  fact: string;
  timestamp: string;
}

interface CategorySelection {
  category: string;
  timestamp: string;
}

interface HistoryItem {
  question: {
    pointMultiplier?: number;
    category?: string;
    difficulty?: string;
    [key: string]: any;
  };
  selectedAnswer: string;
  correct: boolean;
  timestamp: string;
  pointsEarned: number;
  questionNumber?: number;
  totalQuestions?: number;
  categoryBonus?: number;
}

interface DifficultyStats {
  easy: number;
  normal: number;
  hard: number;
  total: number;
}

export async function userProfile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    // 1) Load raw history from regular answers
    const rawHistory = (await getJson<any[]>(`answers/history/${userId}.json`)) || [];

    // 2) Load the answers games keep in their own files (older plays)
    const older = await olderAnswersOf(userId);

    // 3) Combine and enrich with pointsEarned
    const combinedHistory = [...rawHistory, ...older];
    const allHistory: HistoryItem[] = combinedHistory
      .map((h) => {
        // A play of several questions split its points when it was stored
        if ((older.includes(h) || playOf(h)) && h.pointsEarned !== undefined) {
          return h;
        }
        const multiplier = h.question?.pointMultiplier ?? 1;
        const points = h.correct ? multiplier : 0;
        return { ...h, pointsEarned: points };
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // 3) Keep first 10 for front-end (already sorted newest first)
    const history = allHistory.slice(0, 10);

    // 3.5) Create detailed scoring history with game type info
    const scoringHistory = allHistory.map((h) => ({
      date: h.timestamp,
      gameMode: gameModeOf(h as any),
      gameType: serverGame(gameModeOf(h as any) ?? '')?.label ?? 'Regular Trivia',
      category: h.question?.category || 'Unknown',
      difficulty: h.question?.difficulty || 'normal',
      pointsAttempted: h.correct ? h.pointsEarned : h.question?.pointMultiplier || 1,
      pointsEarned: h.pointsEarned,
      correct: h.correct,
      question: h.question?.question || '',
      userAnswer: h.selectedAnswer,
      correctAnswer: h.question?.answer || '',
      // The stored per-mode flags, as the app read them before gameMode.
      ...legacyFlagsOf(h as any),
      questionNumber: h.questionNumber,
      totalQuestions: h.totalQuestions,
    }));

    // 4) Compute totalScore
    const totalScore = allHistory.reduce((sum, h) => sum + h.pointsEarned, 0);

    // 5) Compute streak from answer history (consecutive correct at end)
    let streak = 0;
    for (let i = allHistory.length - 1; i >= 0; i--) {
      if (allHistory[i].correct) {
        streak++;
      } else {
        break;
      }
    }

    // 6) Extract category selections
    const categorySelections: CategorySelection[] = allHistory
      .filter((h) => h.question?.category)
      .map((h) => ({
        category: h.question.category as string,
        timestamp: h.timestamp,
      }));

    // 6b) Compute category bonus stats
    const bonusEntries = allHistory.filter((h) => h.categoryBonus && h.categoryBonus > 0);
    const totalCategoryBonuses = bonusEntries.reduce((sum, h) => sum + (h.categoryBonus || 0), 0);
    const categoryBonusStats = {
      timesBonusEarned: bonusEntries.length,
      totalBonusPoints: totalCategoryBonuses,
    };

    // 7) Compute difficulty breakdown
    const difficultyStats: DifficultyStats = allHistory.reduce(
      (stats, h) => {
        const diff = (h.question?.difficulty || 'normal').toLowerCase();
        if (diff === 'easy') stats.easy++;
        else if (diff === 'hard') stats.hard++;
        else stats.normal++;
        return stats;
      },
      { easy: 0, normal: 0, hard: 0, total: allHistory.length },
    );

    // 8) Load facts from consolidated history
    const factEntries = await getFactHistory(userId);
    const profile: Record<string, any> = {};
    const facts: FactItem[] = [];

    for (const f of factEntries) {
      if (f.answered && !f.skipped && f.question && f.answer) {
        const simpleKey = f.question
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
          .substring(0, 30);
        profile[simpleKey] = f.answer;
        facts.push({
          id: `${f.questionType}_${f.date}`,
          date: f.date || '',
          question: f.question,
          answer: f.answer,
          fact: f.fact || '',
          timestamp: f.timestamp || new Date().toISOString(),
        });
      }
    }

    // 9) Return everything
    return successResponse({
      profile,
      history,
      totalScore,
      streak,
      facts,
      categorySelections,
      difficultyStats,
      categoryBonusStats,
      scoringHistory, // Full history with details
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error fetching user profile:', err as Error);
    return errorResponse('Failed to retrieve user profile', 500);
  }
}
