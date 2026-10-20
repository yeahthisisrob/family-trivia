/**
 * Casino Rush's own endpoints (backend/features/games/casino-rush, served at
 * /casino-rush/*). Its status comes from the rounds, like every game's.
 */
import type { DifficultyLevel, ProgressMessage, Question } from '@family-trivia/shared';
import { gameRequest } from '../kit';

type RushQuestion = Question & {
  questionNumber: number;
  totalQuestions: number;
  timeLimit: number;
};

/** The play under way, as the game shows it. */
export interface CasinoRushSession {
  currentQuestion: RushQuestion;
  difficulty: DifficultyLevel;
  potentialPoints: number;
  messages?: ProgressMessage[];
}

/** What an answer did. */
export interface CasinoRushResult {
  correct: boolean;
  correctAnswer?: string;
  earnedPoints: number;
  gameOver: boolean;
  complete?: boolean;
  message?: string;
  reason?: 'time_expired' | 'wrong_answer';
  nextQuestion?: RushQuestion;
}

/** Start a play, or resume the one under way. Writing three questions takes a while. */
export async function startCasinoRush(
  userId: string,
  difficulty: DifficultyLevel = 'normal',
  withProgress = false,
  isCatchingUp = false,
): Promise<CasinoRushSession> {
  const result = await gameRequest<{ session: CasinoRushSession }>('/casino-rush/start', {
    method: 'POST',
    body: { userId, difficulty, withProgress, isCatchingUp },
    slow: true,
    lenient: true,
    // 90s: question generation can take 20-40s for 3 Bedrock calls
    timeoutMs: 90000,
  });
  if (!result?.session?.currentQuestion) {
    throw new Error('Failed to start Casino Rush - Invalid server response');
  }
  return result.session;
}

export function submitCasinoRushAnswer(userId: string, answer: string): Promise<CasinoRushResult> {
  return gameRequest<CasinoRushResult>('/casino-rush/answer', {
    method: 'POST',
    body: { userId, answer },
    slow: true,
    lenient: true,
  });
}
