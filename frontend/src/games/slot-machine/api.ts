/**
 * The Slot Machine's own endpoints (backend/features/games/slot-machine,
 * served at /slot-machine/*). Its status comes from the rounds, like every game's.
 */
import { createLogger } from '../../shared/lib/logger';
import { gameRequest } from '../kit';

const logger = createLogger('SlotMachineAPI');

/** A spin: the category and the multiplier. */
export interface SlotMachineResult {
  multiplier: number;
  category: string;
  isPersonalQuestion: boolean;
  targetUserName?: string;
}

/** The question after a spin (its answer stays on the server). */
export interface SlotMachineQuestion {
  question: string;
  choices: string[];
  category: string;
  isPersonal?: boolean;
}

export interface SlotMachineAnswerResult {
  correct: boolean;
  correctAnswer?: string;
  pointsEarned: number;
  multiplier: number;
}

/** Spin for a category and a multiplier (the weekly play). */
export async function spinSlotMachine(
  userId: string,
  isCatchingUp = false,
): Promise<SlotMachineResult> {
  logger.info('Spinning slot machine', { userId, isCatchingUp });
  const r = await gameRequest<{ result: SlotMachineResult }>('/slot-machine/spin', {
    method: 'POST',
    body: { userId, isCatchingUp },
  });
  logger.info('Spin result', {
    multiplier: r.result.multiplier,
    category: r.result.category,
    isPersonal: r.result.isPersonalQuestion,
  });
  return r.result;
}

/** The question for the spin. */
export async function getSlotMachineQuestion(
  userId: string,
): Promise<{ question: SlotMachineQuestion; multiplier: number }> {
  logger.info('Getting slot machine question', { userId });
  return gameRequest('/slot-machine/question', { method: 'POST', body: { userId } });
}

export async function submitSlotMachineAnswer(
  userId: string,
  answer: string,
): Promise<SlotMachineAnswerResult> {
  logger.info('Submitting slot machine answer', { userId });
  const r = await gameRequest<SlotMachineAnswerResult>('/slot-machine/answer', {
    method: 'POST',
    body: { userId, answer },
  });
  logger.info('Slot machine answer result', {
    correct: r.correct,
    pointsEarned: r.pointsEarned,
    multiplier: r.multiplier,
  });
  return r;
}

// ── In the casino: bets from its credits, no cooldown ─────────────

export interface ArcadeSpinResult {
  reels: string[];
  payout: number;
  multiplier: number;
  matchType: 'jackpot' | 'partial' | 'none';
  betAmount: number;
  reelStrips: string[][];
}

export function arcadeSlotSpin(userId: string, betAmount: number): Promise<ArcadeSpinResult> {
  return gameRequest<ArcadeSpinResult>('/slot-machine/arcade-spin', {
    method: 'POST',
    body: { userId, betAmount },
  });
}
