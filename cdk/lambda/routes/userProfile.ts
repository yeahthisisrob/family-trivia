// File: lambda/routes/userProfile.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, listObjects } from '../services/s3';
import { getFactHistory } from '../services/factHistoryService';
import { successResponse, errorResponse } from '../config';
import { getAllCasinoRushSessions } from './game-modes/casinoRushUtils';
import { logger } from '../services/logger';

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
  isCasinoRush?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  categoryBonus?: number;
}


export async function getCasinoRushHistory(userId: string): Promise<HistoryItem[]> {
  const historyEntries: HistoryItem[] = [];
  
  try {
    // Get all sessions using utility (checks both old and new paths)
    const sessions = await getAllCasinoRushSessions(userId);
    
    // Process each session
    for (const session of sessions) {
      if (!session || !session.questions) continue;
      
      // Casino Rush only awards points if ALL questions are correct (status = 'completed')
      const isCompleted = session.status === 'completed';
      const allCorrect = session.questions.every(q => q.correct === true);
      const totalSessionPoints = isCompleted && allCorrect ? session.potentialPoints : 0;
      // Divide points evenly among questions to avoid triple counting
      const pointsPerQuestion = totalSessionPoints > 0 ? totalSessionPoints / session.questions.length : 0;
      
      // Process each question in the session
      session.questions.forEach((q, index) => {
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
    // If no casino rush sessions exist, return empty array
    logger.info(`No casino rush sessions for user ${userId}:`, error as Error);
  }
  
  return historyEntries;
}

interface DifficultyStats {
  easy: number;
  normal: number;
  hard: number;
  total: number;
}

export async function userProfile(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    // 1) Load raw history from regular answers
    const rawHistory = (await getJson<any[]>(`answers/history/${userId}.json`)) || [];

    // 2) Load casino rush history
    const casinoHistory = await getCasinoRushHistory(userId);

    // 3) Combine and enrich with pointsEarned
    const combinedHistory = [...rawHistory, ...casinoHistory];
    const allHistory: HistoryItem[] = combinedHistory.map(h => {
      // Casino rush entries already have pointsEarned set
      if (h.isCasinoRush && h.pointsEarned !== undefined) {
        return h;
      }
      const multiplier = h.question?.pointMultiplier ?? 1;
      const points = h.correct ? multiplier : 0;
      return { ...h, pointsEarned: points };
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    

    // 3) Keep first 10 for front-end (already sorted newest first)
    const history = allHistory.slice(0, 10);
    
    // 3.5) Create detailed scoring history with game type info
    const scoringHistory = allHistory.map(h => ({
      date: h.timestamp,
      gameType: h.isCasinoRush ? 'Casino Rush' : 'Regular Trivia',
      category: h.question?.category || 'Unknown',
      difficulty: h.question?.difficulty || 'normal',
      pointsAttempted: h.correct ? h.pointsEarned : (h.question?.pointMultiplier || 1),
      pointsEarned: h.pointsEarned,
      correct: h.correct,
      question: h.question?.question || '',
      userAnswer: h.selectedAnswer,
      correctAnswer: h.question?.answer || '',
      isCasinoRush: h.isCasinoRush || false,
      questionNumber: h.questionNumber,
      totalQuestions: h.totalQuestions
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
      .filter(h => h.question?.category)
      .map(h => ({
        category: h.question.category as string,
        timestamp: h.timestamp,
      }));

    // 6b) Compute category bonus stats
    const bonusEntries = allHistory.filter(h => h.categoryBonus && h.categoryBonus > 0);
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
      { easy: 0, normal: 0, hard: 0, total: allHistory.length }
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
