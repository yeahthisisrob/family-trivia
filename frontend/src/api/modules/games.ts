// Module: games
// Casino Rush and Slot Machine game modes

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

import type {
  CasinoRushSession,
  CasinoRushResult,
  CasinoRushStatus,
  SlotMachineResult,
  SlotMachineQuestion,
  SlotMachineStatus,
  SlotMachineAnswerResult,
} from '@family-trivia/shared';

// Casino Rush type exports
export type { CasinoRushSession, CasinoRushResult, CasinoRushStatus } from '@family-trivia/shared';

// Slot Machine type exports
export type {
  SlotMachineResult,
  SlotMachineQuestion,
  SlotMachineStatus,
  SlotMachineAnswerResult,
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
    throw new Error(
      'Failed to start Casino Rush - Invalid server response',
    );
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
export async function spinSlotMachine(userId: string, isCatchingUp = false): Promise<SlotMachineResult> {
  slotLogger.info('Spinning slot machine', { userId, isCatchingUp });

  const result = await apiService.request<{ result: SlotMachineResult }>(
    '/slot-machine/spin',
    {
      method: 'POST',
      body: JSON.stringify({ userId, isCatchingUp }),
    },
  );

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

  const result = await apiService.request<SlotMachineAnswerResult>(
    '/slot-machine/answer',
    {
      method: 'POST',
      body: JSON.stringify({ userId, answer, groupId }),
    },
  );

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

// Curling
// =============================================================================

const curlingLogger = createLogger('CurlingAPI');

export interface CurlingStatus {
  canPlay: boolean;
  nextAvailable: string | null;
}

export interface CurlingLockResult {
  multiplier: number;
  question: {
    question: string;
    choices: string[];
    category: string;
  };
}

export interface CurlingAnswerResult {
  correct: boolean;
  correctAnswer: string;
  pointsEarned: number;
  multiplier: number;
}

/** Fetch curling cooldown status */
export async function getCurlingStatus(userId: string): Promise<CurlingStatus | null> {
  curlingLogger.info('Getting curling status', { userId });
  try {
    const result = await apiService.request<CurlingStatus>(
      `/curling/status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
      undefined, true, 10000,
    );
    return result;
  } catch (error) {
    curlingLogger.error('Error fetching curling status:', error);
    return { canPlay: false, nextAvailable: new Date(Date.now() + 24*60*60*1000).toISOString() };
  }
}

/** Lock in the multiplier from the throw and get the trivia question */
export async function lockCurling(
  userId: string,
  multiplier: number,
  isCatchingUp = false,
  precisionScore?: number,
): Promise<CurlingLockResult> {
  curlingLogger.info('Locking curling throw', { userId, multiplier, isCatchingUp, precisionScore });
  // Server generates a question via Bedrock — needs a long timeout (45s)
  const result = await apiService.request<CurlingLockResult>('/curling/lock', {
    method: 'POST',
    body: JSON.stringify({ userId, multiplier, isCatchingUp, precisionScore }),
  }, undefined, true, 45000);
  // ApiService swallows errors and returns {} — validate the shape ourselves.
  if (!result || !result.question || !Array.isArray(result.question.choices)) {
    curlingLogger.error('Curling lock returned empty/invalid response', { result });
    throw new Error('Could not start curling — you may have already played today');
  }
  return result;
}

/** Submit the answer for the curling question — scores multiplier × correct */
export async function submitCurlingAnswer(
  userId: string,
  answer: string,
): Promise<CurlingAnswerResult> {
  curlingLogger.info('Submitting curling answer', { userId });
  const result = await apiService.request<CurlingAnswerResult>('/curling/answer', {
    method: 'POST',
    body: JSON.stringify({ userId, answer }),
  });
  if (!result || typeof result.correct !== 'boolean') {
    curlingLogger.error('Curling answer returned empty/invalid response', { result });
    throw new Error('Could not record answer');
  }
  return result;
}

// ── Tetris ──────────────────────────────────────────────────────────────

const tetrisLogger = createLogger('TetrisAPI');

export interface TetrisStatus {
  canPlay: boolean;
  nextAvailable: string | null;
}

export interface TetrisHighScoreEntry {
  userId: string;
  score: number;
  date: string;
}

export interface TetrisLockResult {
  multiplier: number;
  question: {
    question: string;
    choices: string[];
    category: string;
  };
  isNewHighScore: boolean;
  highScores: TetrisHighScoreEntry[];
}

export interface TetrisAnswerResult {
  correct: boolean;
  correctAnswer: string;
  pointsEarned: number;
  multiplier: number;
  highScoreBonus: number;
}

/** Fetch tetris cooldown status */
export async function getTetrisStatus(userId: string): Promise<TetrisStatus | null> {
  tetrisLogger.info('Getting tetris status', { userId });
  try {
    return await apiService.request<TetrisStatus>(
      `/tetris/status?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
      undefined, true, 10000,
    );
  } catch (error) {
    tetrisLogger.error('Error fetching tetris status:', error);
    return { canPlay: false, nextAvailable: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
  }
}

/** Lock the Tetris score + multiplier and get trivia question */
export async function lockTetris(
  userId: string,
  score: number,
  multiplier: number,
  isCatchingUp = false,
): Promise<TetrisLockResult> {
  tetrisLogger.info('Locking tetris score', { userId, score, multiplier, isCatchingUp });
  const result = await apiService.request<TetrisLockResult>('/tetris/lock', {
    method: 'POST',
    body: JSON.stringify({ userId, score, multiplier, isCatchingUp }),
  }, undefined, true, 45000);
  if (!result || !result.question || !Array.isArray(result.question.choices)) {
    tetrisLogger.error('Tetris lock returned empty/invalid response', { result });
    throw new Error('Could not start tetris — you may have already played today');
  }
  return result;
}

/** Submit the answer for the tetris trivia question */
export async function submitTetrisAnswer(
  userId: string,
  answer: string,
): Promise<TetrisAnswerResult> {
  tetrisLogger.info('Submitting tetris answer', { userId });
  const result = await apiService.request<TetrisAnswerResult>('/tetris/answer', {
    method: 'POST',
    body: JSON.stringify({ userId, answer }),
  });
  if (!result || typeof result.correct !== 'boolean') {
    tetrisLogger.error('Tetris answer returned empty/invalid response', { result });
    throw new Error('Could not record answer');
  }
  return result;
}
