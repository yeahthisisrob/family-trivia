// File: lambda/routes/slotMachine.ts
// Purpose: Handle SlotMachine game mode - weekly multiplier with category spinner

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson, listObjects } from '../../services/s3';
import { successResponse, errorResponse, FEATURE_FLAGS } from '../../config';
import { DifficultyLevel, generateMultipleChoiceFromFact } from '../../services/bedrock';
import { S3_PATHS } from '../../constants';
import { logger } from '../../services/logger';
import { getUserFromSameFamily } from './familyUtils';
import { getAvailableCategories } from './shared';
import { canPlayGameMode } from '../../services/gameModeService';
import { PlayMode } from '@family-trivia/shared';
import { getFactContent } from '../../services/factHistoryService';
import { getHighScores, submitScore } from '../../services/arcadeService';
import { getRecentRounds } from '../../services/familyFeudService';
import { getPlayerState, getSeasonSummary } from '../../services/playerStateService';
import { computePoints } from '../../services/scoring';
import type { ArcadeGameId } from '@family-trivia/shared';
import { HistoryEntry as SharedHistoryEntry } from '@family-trivia/shared';
import { generateQuestionWithOptions } from '../questionGeneration/shared';

interface SlotMachineSession {
  userId: string;
  startTime: number;
  lastPlayedAt?: number;
  result: {
    multiplier: number;
    category: string;
    isPersonalQuestion: boolean;
    targetUserId?: string; // Only set for personal questions
    targetUserName?: string; // Only set for personal questions
  };
  question?: {
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: DifficultyLevel;
    answeredAt?: number;
    userAnswer?: string;
    correct?: boolean;
    isPersonal?: boolean;
    pointsEarned?: number;
  };
  status: 'active' | 'completed' | 'failed';
  isCatchingUp?: boolean;
  // New fields for enhanced features
  streak?: number;
  bonusFeatures?: {
    doubleChance?: boolean; // Give a second chance on wrong answer
    hint?: boolean; // Provide a hint for the question
    skipAvailable?: boolean; // Allow skipping to a new question
  };
}

interface SlotMachineStats {
  userId: string;
  totalPlays: number;
  totalWins: number;
  totalPoints: number;
  bestStreak: number;
  jackpotWins: number; // 5x multiplier wins
  lastJackpotDate?: number;
  favoriteCategories: { [category: string]: number };
  multiplierHistory: number[];
  averageMultiplier: number;
}

const COOLDOWN_PERIOD = 7 * 24 * 60 * 60 * 1000; // 1 week
const SLOT_MACHINE_SESSION_KEY = (userId: string) => `slot-machine/${userId}/session.json`;
const SLOT_MACHINE_STATS_KEY = (userId: string) => `slot-machine/${userId}/stats.json`;

// Enhanced multiplier options with dynamic weights based on performance
const MULTIPLIER_OPTIONS = [
  { value: 1, weight: 4, color: 'standard' },
  { value: 2, weight: 2, color: 'bronze' },
  { value: 3, weight: 1, color: 'silver' },
  { value: 5, weight: 1, color: 'gold' }
];

// Special event multipliers (e.g., holidays, weekends)
const SPECIAL_EVENT_MULTIPLIERS = {
  weekend: 1.2, // 20% better odds on weekends
  milestone: 1.5, // 50% better odds on milestone plays (10th, 25th, etc.)
  streak: 1.3, // 30% better odds if on a streak
};

/**
 * Get user statistics for slot machine
 */
async function getUserStats(userId: string): Promise<SlotMachineStats> {
  try {
    const stats = await getJson<SlotMachineStats>(SLOT_MACHINE_STATS_KEY(userId));
    return stats || createDefaultStats(userId);
  } catch (error) {
    return createDefaultStats(userId);
  }
}

/**
 * Create default stats for new user
 */
function createDefaultStats(userId: string): SlotMachineStats {
  return {
    userId,
    totalPlays: 0,
    totalWins: 0,
    totalPoints: 0,
    bestStreak: 0,
    jackpotWins: 0,
    favoriteCategories: {},
    multiplierHistory: [],
    averageMultiplier: 1,
  };
}

/**
 * Update user statistics
 */
async function updateUserStats(
  userId: string,
  session: SlotMachineSession,
  isWin: boolean,
  pointsEarned: number
): Promise<void> {
  const stats = await getUserStats(userId);
  
  stats.totalPlays++;
  if (isWin) {
    stats.totalWins++;
    stats.totalPoints += pointsEarned;
  }
  
  // Update multiplier history
  stats.multiplierHistory.push(session.result.multiplier);
  if (stats.multiplierHistory.length > 50) {
    stats.multiplierHistory.shift(); // Keep only last 50
  }
  
  // Calculate average multiplier
  stats.averageMultiplier = stats.multiplierHistory.reduce((a, b) => a + b, 0) / stats.multiplierHistory.length;
  
  // Update jackpot wins
  if (session.result.multiplier === 5) {
    stats.jackpotWins++;
    stats.lastJackpotDate = Date.now();
  }
  
  // Update favorite categories
  const category = session.result.category;
  stats.favoriteCategories[category] = (stats.favoriteCategories[category] || 0) + 1;
  
  // Update best streak if needed
  if (session.streak && session.streak > stats.bestStreak) {
    stats.bestStreak = session.streak;
  }
  
  await putJson(SLOT_MACHINE_STATS_KEY(userId), stats);
}

/**
 * Check if user is eligible for bonus features
 */
function checkBonusFeatures(stats: SlotMachineStats): SlotMachineSession['bonusFeatures'] {
  const bonusFeatures: SlotMachineSession['bonusFeatures'] = {};
  
  // Double chance for players with 5+ plays and < 50% win rate
  if (stats.totalPlays >= 5 && stats.totalWins / stats.totalPlays < 0.5) {
    bonusFeatures.doubleChance = Math.random() < 0.3; // 30% chance
  }
  
  // Hint for players on a cold streak (3+ losses)
  const recentLosses = stats.totalPlays - stats.totalWins;
  if (recentLosses >= 3) {
    bonusFeatures.hint = Math.random() < 0.4; // 40% chance
  }
  
  // Skip available for loyal players (10+ plays)
  if (stats.totalPlays >= 10) {
    bonusFeatures.skipAvailable = Math.random() < 0.2; // 20% chance
  }
  
  return bonusFeatures;
}

/**
 * Check if a user can play SlotMachine based on cooldown period
 */
async function canPlaySlotMachine(
  userId: string,
  playMode: PlayMode = 'slot-machine',
): Promise<{ canPlay: boolean; nextAvailable?: Date; session?: SlotMachineSession; blockedReason?: string }> {
  // Active session blocks a new game
  let session: SlotMachineSession | undefined;
  try {
    const s = await getJson<SlotMachineSession>(SLOT_MACHINE_SESSION_KEY(userId));
    session = s ?? undefined;
    if (session?.status === 'active') {
      return { canPlay: false, session, blockedReason: 'active_session' };
    }
  } catch { /* no session */ }

  // Weekly cooldown + eligibility for the given PlayMode.
  const { canPlay, nextAvailable, blockedReason } = await canPlayGameMode(userId, 'slot-machine', playMode);
  return { canPlay, ...(nextAvailable && { nextAvailable }), ...(session && { session }), ...(blockedReason && { blockedReason }) };
}

/**
 * Get a weighted random multiplier with dynamic adjustments
 */
async function getRandomMultiplier(userId: string): Promise<number> {
  const stats = await getUserStats(userId);
  const now = new Date();
  
  // Calculate dynamic weight multiplier
  let weightMultiplier = 1;
  
  // Weekend bonus
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;
  if (isWeekend) {
    weightMultiplier *= SPECIAL_EVENT_MULTIPLIERS.weekend;
  }
  
  // Milestone bonus (every 10th play)
  if (stats.totalPlays > 0 && stats.totalPlays % 10 === 9) {
    weightMultiplier *= SPECIAL_EVENT_MULTIPLIERS.milestone;
  }
  
  // Pity system - increase odds if no jackpot in 20+ plays
  const playsSinceJackpot = stats.totalPlays - (stats.lastJackpotDate ? 
    Math.floor((Date.now() - stats.lastJackpotDate) / COOLDOWN_PERIOD) : 0);
  if (playsSinceJackpot > 20) {
    weightMultiplier *= 1.5;
  }
  
  // Apply weight multiplier to higher multipliers
  const adjustedOptions = MULTIPLIER_OPTIONS.map(option => ({
    ...option,
    weight: option.value > 2 ? option.weight * weightMultiplier : option.weight
  }));
  
  const totalWeight = adjustedOptions.reduce((sum, option) => sum + option.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const option of adjustedOptions) {
    random -= option.weight;
    if (random <= 0) {
      return option.value;
    }
  }
  
  // Fallback to 1x if something goes wrong
  return 1;
}

/**
 * Generate a question for the slot machine
 */
async function generateSlotMachineQuestion(
  userId: string,
  category: string,
  isPersonalQuestion: boolean,
  targetUserId?: string,
  targetUserName?: string
): Promise<{
  question: string;
  choices: string[];
  answer: string;
  category: string;
  difficulty: DifficultyLevel;
  isPersonal: boolean;
}> {
  // If it's a personal question, we need to find a fact from the target user
  if (isPersonalQuestion && targetUserId) {
    logger.info('Generating personal question for slot machine', { userId, targetUserId });
    
    // Find a random answered fact from the target user
    const factContent = await getFactContent(targetUserId);

    if (!factContent.length) {
      throw new Error(`No facts found for target user ${targetUserId}`);
    }

    const factData = factContent[Math.floor(Math.random() * factContent.length)];
    
    // Generate a multiple choice question from the fact, using the person's name
    const questionData = await generateMultipleChoiceFromFact(
      factData.question,
      factData.answer,
      targetUserName,
    );
    
    return {
      ...questionData,
      category: 'Personal',
      difficulty: 'normal',
      isPersonal: true
    };
  } else {
    // Regular trivia question — uses the same shared pipeline as regular trivia and Casino Rush
    logger.info('Generating trivia question for slot machine', { userId, category });

    const isCustomCategory = category.startsWith('Custom:');
    const mode = isCustomCategory ? 'custom' : 'category';

    const result = await generateQuestionWithOptions({
      userId,
      mode,
      category,
      difficulty: 'normal',
      skipDailyCheck: true,
    });

    return {
      ...result.question,
      category,
      difficulty: 'normal' as DifficultyLevel,
      isPersonal: false,
    };
  }
}


/**
 * Calculate current streak from session/stats
 */
async function calculateStreak(userId: string): Promise<number> {
  try {
    // Check if there's an active or recently completed session with streak info
    const session = await getJson<SlotMachineSession>(SLOT_MACHINE_SESSION_KEY(userId));
    if (session && session.streak !== undefined) {
      return session.streak;
    }
    
    // Otherwise check stats
    const stats = await getUserStats(userId);
    // Return 0 if last play wasn't a win (streak broken)
    // This is tracked in the stats when we update them
    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Handle spinning the slot machine
 */
export async function slotMachineSpin(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Check feature flag first
  if (!FEATURE_FLAGS.SLOT_MACHINE_ENABLED) {
    return errorResponse('Feature disabled', 503, 'Slot Machine is temporarily disabled');
  }

  const body = JSON.parse(event.body || '{}');
  const { userId, isCatchingUp } = body;

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  // Unified eligibility: daily limit (catchup bypass), weekly cooldown, active session.
  const { canPlay, nextAvailable, session: existingSession, blockedReason } =
    await canPlaySlotMachine(userId, isCatchingUp ? 'catchup' : 'slot-machine');
  if (!canPlay) {
    logger.info(`Slot Machine blocked for ${userId}: ${blockedReason}`);
    // If there's an active session, return it
    if (existingSession?.status === 'active') {
      return successResponse({
        result: existingSession.result,
        bonusFeatures: existingSession.bonusFeatures,
        hasActiveSession: true
      });
    }

    const msg =
      blockedReason === 'end_of_season' ? 'Season has ended' :
      blockedReason === 'no_catchup_available' ? 'No catch-up questions available' :
      blockedReason === 'daily_limit_reached' ? 'Daily limit reached — try again tomorrow!' :
      'Slot Machine is on cooldown';
    return errorResponse(msg, 403, nextAvailable?.toISOString(), blockedReason || 'COOLDOWN');
  }
  
  try {
    // Get user stats for bonus features
    const stats = await getUserStats(userId);
    const bonusFeatures = checkBonusFeatures(stats);
    
    // Get current streak
    const currentStreak = await calculateStreak(userId);
    
    // Get all categories
    const allCategories = await getAvailableCategories(userId);
    
    // Determine if this will be a personal question (20% chance, 30% if on streak)
    const personalChance = currentStreak >= 3 ? 0.3 : 0.2;
    const isPersonalQuestion = Math.random() < personalChance;
    
    let targetUserId: string | undefined;
    let targetUserName: string | undefined;
    let selectedCategory: string;
    
    if (isPersonalQuestion) {
      // Get a family member on the same side
      const targetUser = await getUserFromSameFamily(userId);
      
      if (targetUser) {
        targetUserId = targetUser.id;
        targetUserName = targetUser.name;
        selectedCategory = 'Personal';
      } else {
        // Fallback to regular trivia if no family member found
        selectedCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
      }
    } else {
      // Pick a random category with slight bias towards favorites
      const favoriteCategories = Object.entries(stats.favoriteCategories)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([cat]) => cat);
      
      // 30% chance to pick from favorites if available
      if (favoriteCategories.length > 0 && Math.random() < 0.3) {
        selectedCategory = favoriteCategories[Math.floor(Math.random() * favoriteCategories.length)];
      } else {
        selectedCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
      }
    }
    
    // Get a random multiplier with dynamic adjustments
    const multiplier = await getRandomMultiplier(userId);
    
    // Create a new session
    const now = Date.now();
    const session: SlotMachineSession = {
      userId,
      startTime: now,
      lastPlayedAt: now,
      result: {
        multiplier,
        category: selectedCategory,
        isPersonalQuestion: isPersonalQuestion && !!targetUserId,
        targetUserId,
        targetUserName
      },
      status: 'active',
      isCatchingUp: isCatchingUp || false,
      streak: currentStreak,
      bonusFeatures: bonusFeatures && Object.keys(bonusFeatures).length > 0 ? bonusFeatures : undefined
    };
    
    // Save the session
    await putJson(SLOT_MACHINE_SESSION_KEY(userId), session);
    
    // Return the spinning result
    return successResponse({
      result: {
        multiplier,
        category: selectedCategory,
        isPersonalQuestion: isPersonalQuestion && !!targetUserId,
        targetUserName
      },
      bonusFeatures,
      currentStreak,
      stats: {
        totalPlays: stats.totalPlays + 1,
        averageMultiplier: stats.averageMultiplier,
        jackpotWins: stats.jackpotWins
      }
    });
  } catch (error: any) {
    logger.error('Error in slot machine spin', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to spin slot machine', 500, error.message || 'Unknown error');
  }
}

/**
 * Generate a question after spinning
 */
export async function slotMachineQuestion(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, skipQuestion } = body;
  
  if (!userId) {
    return errorResponse('Missing userId', 400);
  }

  try {
    // Get the active session
    const session = await getJson<SlotMachineSession>(SLOT_MACHINE_SESSION_KEY(userId));

    if (!session || session.status !== 'active') {
      return errorResponse('No active slot machine session', 400);
    }
    
    // Handle skip if available and requested
    if (skipQuestion && session.bonusFeatures?.skipAvailable) {
      // Generate a new category and question
      const allCategories = await getAvailableCategories(userId);
      const newCategory = allCategories[Math.floor(Math.random() * allCategories.length)];
      session.result.category = newCategory;
      session.result.isPersonalQuestion = false;
      session.bonusFeatures.skipAvailable = false; // Use up the skip
      
      // Clear any existing question
      delete session.question;
      
      // Save updated session
      await putJson(SLOT_MACHINE_SESSION_KEY(userId), session);
    }
    
    if (session.question && !skipQuestion) {
      // Question already generated, return it
      return successResponse({
        question: {
          question: session.question.question,
          choices: session.question.choices,
          category: session.question.category,
          isPersonal: session.question.isPersonal
        },
        multiplier: session.result.multiplier,
        bonusFeatures: session.bonusFeatures,
        hint: session.bonusFeatures?.hint ?
          `Hint: The answer is NOT "${session.question.choices[0]}"` : undefined
      });
    }
    
    // Generate a new question
    const questionData = await generateSlotMachineQuestion(
      userId,
      session.result.category,
      session.result.isPersonalQuestion,
      session.result.targetUserId,
      session.result.targetUserName,
    );
    
    // Update the session with the question
    session.question = questionData;
    await putJson(SLOT_MACHINE_SESSION_KEY(userId), session);
    
    // Prepare hint if available
    let hint: string | undefined;
    if (session.bonusFeatures?.hint) {
      // Find a wrong answer to eliminate
      const wrongAnswers = questionData.choices.filter(c => c !== questionData.answer);
      hint = `Hint: The answer is NOT "${wrongAnswers[0]}"`;
    }
    
    // Return the question
    return successResponse({
      question: {
        question: questionData.question,
        choices: questionData.choices,
        category: questionData.category,
        isPersonal: questionData.isPersonal
      },
      multiplier: session.result.multiplier,
      bonusFeatures: session.bonusFeatures,
      hint
    });
  } catch (error: any) {
    logger.error('Error generating slot machine question', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to generate slot machine question', 500, error.message || 'Unknown error');
  }
}

/**
 * Submit an answer for the slot machine question
 */
export async function slotMachineAnswer(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { userId, answer, useDoubleChance } = body;
  
  if (!userId || !answer) {
    return errorResponse('Missing userId or answer', 400);
  }

  try {
    // Get the active session
    const session = await getJson<SlotMachineSession>(SLOT_MACHINE_SESSION_KEY(userId));

    if (!session || session.status !== 'active' || !session.question) {
      return errorResponse('No active slot machine session or question', 400);
    }
    
    const question = session.question;
    const now = Date.now();
    
    // Check the answer
    let isCorrect = answer === question.answer;
    
    // Handle double chance if wrong and available
    if (!isCorrect && useDoubleChance && session.bonusFeatures?.doubleChance && !question.userAnswer) {
      // First attempt failed, give them another chance
      question.userAnswer = answer; // Store first attempt
      session.bonusFeatures.doubleChance = false; // Use up the double chance
      await putJson(SLOT_MACHINE_SESSION_KEY(userId), session);
      
      return successResponse({
        correct: false,
        doubleChanceUsed: true,
        message: 'Wrong answer! But you have a second chance!',
        remainingChoices: question.choices.filter(c => c !== answer)
      });
    }
    
    // Calculate points
    const pointsEarned = isCorrect ? session.result.multiplier : 0;
    
    // Update the session
    question.userAnswer = answer;
    question.correct = isCorrect;
    question.answeredAt = now;
    question.pointsEarned = pointsEarned;
    
    // Update streak
    if (isCorrect && session.streak !== undefined) {
      session.streak++;
    } else {
      session.streak = 0;
    }
    
    session.status = 'completed';
    await putJson(SLOT_MACHINE_SESSION_KEY(userId), session);

    // Archive the completed session so all games show in timeline (not just the latest)
    const archiveKey = `slot-machine/${userId}/sessions/${session.startTime}_${isCorrect ? 'won' : 'lost'}.json`;
    await putJson(archiveKey, session);

    // Persist to answer history so leaderboard scoring picks it up
    try {
      const histKey = S3_PATHS.ANSWER_HISTORY(userId);
      const history = (await getJson<any[]>(histKey)) || [];
      history.push({
        question: {
          question: question.question,
          choices: question.choices,
          answer: question.answer,
          category: session.result.category,
          difficulty: question.difficulty || 'normal',
          pointMultiplier: session.result.multiplier,
        },
        selectedAnswer: answer,
        correct: isCorrect,
        timestamp: new Date(now).toISOString(),
        pointsEarned,
        isSlotMachine: true,
        ...(session.isCatchingUp && { isCatchingUp: true }),
      });
      await putJson(histKey, history);
    } catch (histErr: any) {
      logger.error('Failed to write slot machine result to answer history', {
        userId, error: histErr.message,
      });
    }

    // Update user stats
    await updateUserStats(userId, session, isCorrect, pointsEarned);
    
    // Get updated stats for response
    const stats = await getUserStats(userId);
    
    // Return the result
    return successResponse({
      correct: isCorrect,
      correctAnswer: question.answer,
      pointsEarned,
      multiplier: session.result.multiplier,
      newStreak: session.streak,
      stats: {
        totalWins: stats.totalWins,
        totalPlays: stats.totalPlays,
        bestStreak: stats.bestStreak,
        recentJackpot: session.result.multiplier === 5
      }
    });
  } catch (error: any) {
    logger.error('Error submitting slot machine answer', {
      userId,
      answer,
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to submit slot machine answer', 500, error.message || 'Unknown error');
  }
}

/**
 * Get the status of slot machine availability
 */
export async function slotMachineStatus(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  // Check feature flag first
  if (!FEATURE_FLAGS.SLOT_MACHINE_ENABLED) {
    return successResponse({
      canPlay: false,
      reason: 'feature_disabled',
      message: 'Slot Machine is temporarily disabled'
    });
  }

  const userId = event.queryStringParameters?.userId;

  if (!userId) {
    return errorResponse('Missing userId', 400);
  }
  
  try {
    const { canPlay, nextAvailable } = await canPlaySlotMachine(userId);
    const stats = await getUserStats(userId);
    const currentStreak = await calculateStreak(userId);
    
    // Check for active session
    let activeSession;
    try {
      const session = await getJson<SlotMachineSession>(SLOT_MACHINE_SESSION_KEY(userId));
      if (session?.status === 'active') {
        activeSession = {
          hasActiveSession: true,
          hasQuestion: !!session.question,
          result: session.result,
          bonusFeatures: session.bonusFeatures
        };
      }
    } catch (err) {
      // No active session
    }
    
    return successResponse({
      canPlay,
      nextAvailable,
      activeSession,
      stats: {
        totalPlays: stats.totalPlays,
        totalWins: stats.totalWins,
        bestStreak: stats.bestStreak,
        currentStreak,
        averageMultiplier: Math.round(stats.averageMultiplier * 10) / 10,
        jackpotWins: stats.jackpotWins,
        winRate: stats.totalPlays > 0 ? Math.round((stats.totalWins / stats.totalPlays) * 100) : 0
      }
    });
  } catch (error: any) {
    logger.error('Error getting slot machine status', {
      userId,
      error: error.message,
      stack: error.stack
    });
    
    return errorResponse('Failed to get slot machine status', 500, error.message || 'Unknown error');
  }
}

// ── Arcade Mode ─────────────────────────────────────────────────────

// Symbols on each reel — more symbols = harder to match (like real machines).
// Real slots have 20-30 stops per reel. We use 15 weighted stops.
const ARCADE_SYMBOLS = ['🍒', '🍋', '🍉', '🍊', '🔔', '⭐', '7️⃣', '💎', '🍀'] as const;
type ArcadeSymbol = typeof ARCADE_SYMBOLS[number];

// Weights per reel stop — common fruits appear many times, rare symbols few.
// Total weight = 100, so probability = weight/100 per reel.
const SYMBOL_WEIGHTS: Record<ArcadeSymbol, number> = {
  '🍒': 22, '🍋': 20, '🍉': 16, '🍊': 14, '🔔': 10, '⭐': 8, '7️⃣': 5, '💎': 3, '🍀': 2,
};

// 3-of-a-kind payouts (bet multiplier)
const SYMBOL_PAYOUTS: Record<ArcadeSymbol, number> = {
  '🍒': 3, '🍋': 4, '🍉': 5, '🍊': 6, '🔔': 10, '⭐': 15, '7️⃣': 25, '💎': 50, '🍀': 100,
};

// 2-of-a-kind (any pair) — only pays for the better symbols.
// Common fruits (cherry, lemon, watermelon, orange) don't pay for pairs.
const PARTIAL_PAYOUT: Record<ArcadeSymbol, number> = {
  '🍒': 0, '🍋': 0, '🍉': 0, '🍊': 0, '🔔': 1, '⭐': 2, '7️⃣': 3, '💎': 5, '🍀': 10,
};

function pickRandomSymbol(): ArcadeSymbol {
  const totalWeight = Object.values(SYMBOL_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (const sym of ARCADE_SYMBOLS) {
    r -= SYMBOL_WEIGHTS[sym];
    if (r <= 0) return sym;
  }
  return '🍒';
}

function calculatePayout(reels: ArcadeSymbol[], betAmount: number): { payout: number; multiplier: number; matchType: string } {
  // 3 of a kind
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const mult = SYMBOL_PAYOUTS[reels[0]];
    return { payout: betAmount * mult, multiplier: mult, matchType: 'jackpot' };
  }
  // 2 of a kind (first two or last two or first+last)
  const pairs = [
    [reels[0], reels[1]], [reels[1], reels[2]], [reels[0], reels[2]],
  ];
  for (const [a, b] of pairs) {
    if (a === b) {
      const mult = PARTIAL_PAYOUT[a as ArcadeSymbol];
      return { payout: betAmount * mult, multiplier: mult, matchType: 'partial' };
    }
  }
  return { payout: 0, multiplier: 0, matchType: 'none' };
}

/**
 * POST /slot-machine/arcade-spin — arcade mode, no cooldown, bet-based
 * Body: { userId, betAmount }
 */
export async function slotMachineArcadeSpin(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, betAmount } = body as { userId: string; betAmount: number };

    if (!userId) return errorResponse('Missing userId', 400);
    if (!betAmount || ![0.25, 1, 5, 25].includes(betAmount)) {
      return errorResponse('Invalid bet amount — must be 0.25, 1, 5, or 25', 400);
    }

    // Pick 3 random symbols
    const reels: ArcadeSymbol[] = [pickRandomSymbol(), pickRandomSymbol(), pickRandomSymbol()];
    const { payout, multiplier, matchType } = calculatePayout(reels, betAmount);

    // Record high payout in arcade leaderboard
    if (payout > 0) {
      await submitScore('slot-machine', userId, payout, 'arcade').catch(err =>
        logger.warn('Failed to submit arcade slot score', { error: err instanceof Error ? err.message : String(err) }),
      );
    }

    logger.info('Arcade slot spin', { userId, betAmount, reels, payout, multiplier, matchType });

    return successResponse({
      reels,
      payout,
      multiplier,
      matchType,
      betAmount,
      // Return full reel strips for animation (each reel shows extra symbols above/below payline)
      reelStrips: [
        [pickRandomSymbol(), reels[0], pickRandomSymbol()],
        [pickRandomSymbol(), reels[1], pickRandomSymbol()],
        [pickRandomSymbol(), reels[2], pickRandomSymbol()],
      ],
    });
  } catch (error: any) {
    logger.error('Arcade slot spin error', { error: error.message });
    return errorResponse('Failed to spin', 500);
  }
}

/**
 * GET /slot-machine/balance?userId=X — returns user's trivia points as starting cash
 */
export async function slotMachineBalance(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const [playerState, seasonSummary] = await Promise.all([
      getPlayerState(userId),
      getSeasonSummary(),
    ]);

    // Compute season-filtered score that matches the leaderboard.
    // The leaderboard totalScore = triviaPoints + feudPoints + arcadeBonus.
    // Previously this only returned triviaPoints, causing a mismatch.
    let triviaPoints = 0;
    const seasonStart = seasonSummary.activeSeason?.startDate;
    const seasonEnd = seasonSummary.activeSeason?.endDate;

    if (playerState?.history && seasonStart) {
      for (const h of playerState.history) {
        const d = h.timestamp?.split('T')[0];
        if (!d || d < seasonStart) continue;
        if (seasonEnd && d > seasonEnd) continue;
        if ((h as SharedHistoryEntry).correct) triviaPoints += computePoints(h as SharedHistoryEntry);
      }
    } else {
      triviaPoints = playerState?.score ?? 0;
    }

    // Family Feud points
    let feudPoints = 0;
    try {
      const feudRounds = await getRecentRounds(100);
      for (const round of feudRounds) {
        if (round.results?.winners) {
          for (const winner of round.results.winners) {
            if (winner.userId === userId) {
              const roundDate = round.startedAt?.split('T')[0];
              if (seasonStart && roundDate) {
                if (roundDate >= seasonStart && (!seasonEnd || roundDate <= seasonEnd)) {
                  feudPoints += winner.points;
                }
              } else {
                feudPoints += winner.points;
              }
            }
          }
        }
      }
    } catch { /* feud data may not exist */ }

    // Arcade high score bonus (Gold=3, Silver=2, Bronze=1)
    let arcadeBonus = 0;
    try {
      const ARCADE_GAMES: ArcadeGameId[] = ['tetris', 'curling', 'slot-machine'];
      const PLACEMENT_BONUS = [3, 2, 1];
      const allScores = await Promise.all(ARCADE_GAMES.map(g => getHighScores(g)));
      for (const scores of allScores) {
        const awarded = new Set<string>();
        let rank = 0;
        for (const entry of scores) {
          if (awarded.has(entry.userId)) continue;
          if (rank >= 3) break;
          if (entry.userId === userId) arcadeBonus += PLACEMENT_BONUS[rank];
          awarded.add(entry.userId);
          rank++;
        }
      }
    } catch { /* arcade data may not exist */ }

    const balance = triviaPoints + feudPoints + arcadeBonus;
    return successResponse({ balance });
  } catch (error: any) {
    logger.error('Failed to get slot balance', { userId, error: error.message });
    return successResponse({ balance: 0 });
  }
}