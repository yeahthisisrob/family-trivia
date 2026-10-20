// Module: games
// Casino Rush and Slot Machine game modes

import type {
  CasinoRushResult,
  CasinoRushSession,
  CasinoRushStatus,
  SlotMachineAnswerResult,
  SlotMachineQuestion,
  SlotMachineResult,
  SlotMachineStatus,
} from '@family-trivia/shared';
import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

// Casino Rush type exports
// Slot Machine type exports
export type {
  CasinoRushResult,
  CasinoRushSession,
  CasinoRushStatus,
  SlotMachineAnswerResult,
  SlotMachineQuestion,
  SlotMachineResult,
  SlotMachineStatus,
} from '@family-trivia/shared';

// =============================================================================
// Casino Rush
// =============================================================================

/**
 * Start a new Casino Rush game
 */
export async function startCasinoRush(
  userId: string,
  difficulty: 'easy' | 'normal' | 'hard' = 'normal',
  withProgress = false,
  isCatchingUp = false,
): Promise<CasinoRushSession> {
  const result = await apiService.request<{ session: CasinoRushSession }>(
    '/casino-rush/start',
    {
      method: 'POST',
      body: JSON.stringify({ userId, difficulty, withProgress, isCatchingUp }),
    },
    undefined, // legacyCacheKey
    false, // legacyForceFresh
    90000, // 90s timeout — question generation can take 20-40s for 3 Bedrock calls
  );

  if (!result?.session?.currentQuestion) {
    throw new Error('Failed to start Casino Rush - Invalid server response');
  }

  return result.session;
}

/**
 * Submit an answer in Casino Rush
 */
export async function submitCasinoRushAnswer(
  userId: string,
  answer: string,
): Promise<CasinoRushResult> {
  const result = await apiService.request<CasinoRushResult>('/casino-rush/answer', {
    method: 'POST',
    body: JSON.stringify({ userId, answer }),
  });

  return result;
}

/**
 * Get Casino Rush status for a user with improved error handling
 */
export async function getCasinoRushStatus(
  userId: string,
  _force = true, // kept for API compat; client-side caching removed
): Promise<CasinoRushStatus | null> {
  try {
    const logger = createLogger('CasinoRushAPI');
    logger.info('Getting Casino Rush status', { userId });

    // No client cache — backend has per-invocation cache, that's enough.
    // Client caching caused stale status on mobile after game completion.
    const result = await apiService.request<CasinoRushStatus>(
      `/casino-rush/status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
      undefined, // no cacheKey
      true, // force fresh
      10000,
    );
    return result;
  } catch (error) {
    // Log the error but return a fallback value instead of throwing
    const logger = createLogger('CasinoRushAPI');
    logger.error('Error fetching Casino Rush status:', error);

    // Return a default value - the UI will handle this appropriately
    return {
      canPlay: false, // Default to locked
      nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000), // Default to tomorrow
    };
  }
}

// =============================================================================
// Slot Machine
// =============================================================================

const slotLogger = createLogger('SlotMachineAPI');

/**
 * Spin the slot machine to get a category and multiplier
 */
export async function spinSlotMachine(
  userId: string,
  isCatchingUp = false,
): Promise<SlotMachineResult> {
  slotLogger.info('Spinning slot machine', { userId, isCatchingUp });

  const result = await apiService.request<{ result: SlotMachineResult }>('/slot-machine/spin', {
    method: 'POST',
    body: JSON.stringify({ userId, isCatchingUp }),
  });

  slotLogger.info('Spin result', {
    multiplier: result.result.multiplier,
    category: result.result.category,
    isPersonal: result.result.isPersonalQuestion,
  });

  return result.result;
}

/**
 * Get a question for the slot machine game
 */
export async function getSlotMachineQuestion(userId: string): Promise<{
  question: SlotMachineQuestion;
  multiplier: number;
}> {
  slotLogger.info('Getting slot machine question', { userId });

  const result = await apiService.request<{ question: SlotMachineQuestion; multiplier: number }>(
    '/slot-machine/question',
    {
      method: 'POST',
      body: JSON.stringify({ userId }),
    },
  );

  slotLogger.info('Got slot machine question', {
    category: result.question.category,
    multiplier: result.multiplier,
    isPersonal: result.question.isPersonal,
  });

  return result;
}

/**
 * Submit an answer for the slot machine question
 */
export async function submitSlotMachineAnswer(
  userId: string,
  answer: string,
  groupId: string,
): Promise<SlotMachineAnswerResult> {
  slotLogger.info('Submitting slot machine answer', { userId });

  const result = await apiService.request<SlotMachineAnswerResult>('/slot-machine/answer', {
    method: 'POST',
    body: JSON.stringify({ userId, answer, groupId }),
  });

  slotLogger.info('Slot machine answer result', {
    correct: result.correct,
    pointsEarned: result.pointsEarned,
    multiplier: result.multiplier,
  });

  return result;
}

/**
 * Get the status of slot machine availability for a user with improved error handling
 */
export async function getSlotMachineStatus(
  userId: string,
  _force = true, // kept for API compat; client-side caching removed
): Promise<SlotMachineStatus | null> {
  slotLogger.info('Getting slot machine status', { userId });

  try {
    // No client cache — always hit backend. Prevents stale status after
    // game completion (especially on mobile after switching devices).
    const result = await apiService.request<SlotMachineStatus>(
      `/slot-machine/status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
      undefined, // no cacheKey
      true, // force fresh
      10000,
    );

    slotLogger.info('Slot machine status', {
      canPlay: result.canPlay,
      hasActiveSession: !!result.activeSession,
    });

    return result;
  } catch (error) {
    // Log the error but return a fallback value instead of throwing
    slotLogger.error('Error fetching Slot Machine status:', error);

    // Return a default value - the UI will handle this appropriately
    return {
      canPlay: false, // Default to locked
      nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default to tomorrow
    };
  }
}

// =============================================================================
// Slot Machine — Arcade mode

export interface ArcadeSpinResult {
  reels: string[];
  payout: number;
  multiplier: number;
  matchType: 'jackpot' | 'partial' | 'none';
  betAmount: number;
  reelStrips: string[][];
}

export async function arcadeSlotSpin(userId: string, betAmount: number): Promise<ArcadeSpinResult> {
  return apiService.request<ArcadeSpinResult>('/slot-machine/arcade-spin', {
    method: 'POST',
    body: JSON.stringify({ userId, betAmount }),
  });
}

export async function getSlotBalance(userId: string): Promise<{ balance: number }> {
  try {
    return await apiService.request<{ balance: number }>(
      `/slot-machine/balance?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
    );
  } catch {
    return { balance: 0 };
  }
}
