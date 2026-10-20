/**
 * Casino Rush plays kept in the game's own files: the current play, the
 * older single session file, and the archived sessions from before the
 * answer history held the answers. Read as answers for the leaderboard and
 * the profile, the same way they always were.
 */
import type { DifficultyLevel, HistoryEntry, ProgressMessage } from '@family-trivia/shared';
import { logger } from '../../../services/logger';
import { getJson, listObjects } from '../../../services/s3';
import { keys } from './keys';

/** A Casino Rush play as stored. */
export interface CasinoRushSession {
  userId: string;
  startTime: number;
  questions: Array<{
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: DifficultyLevel;
    /** When this question was first presented. */
    startedAt?: number;
    answeredAt?: number;
    userAnswer?: string;
    correct?: boolean;
  }>;
  currentQuestionIndex: number;
  difficulty: DifficultyLevel;
  status: 'active' | 'completed' | 'failed';
  potentialPoints: number;
  lastPlayedAt?: number;
  isCatchingUp?: boolean;
  /** Progress messages from writing the first question. */
  progressMessages?: ProgressMessage[];
}

const answered = (s: CasinoRushSession | null | undefined): s is CasinoRushSession =>
  !!s?.questions?.length && s.questions.some((q) => q.answeredAt !== undefined);

/**
 * Every play with at least one answer: the old session file, the current
 * one and the archived sessions. The same play can sit in more than one of
 * them, so they are told apart by start time.
 */
async function allSessions(userId: string): Promise<CasinoRushSession[]> {
  const found: CasinoRushSession[] = [];
  for (const key of [keys.legacy(userId), keys.current(userId)]) {
    const s = await getJson<CasinoRushSession>(key).catch(() => null);
    if (answered(s)) found.push(s);
  }
  try {
    // Listing is the reliable way: history.json can be missing or broken.
    for (const file of await listObjects(keys.sessions(userId))) {
      const s = await getJson<CasinoRushSession>(file).catch(() => null);
      if (answered(s)) found.push(s);
    }
  } catch {
    logger.debug(`No Casino Rush sessions directory for ${userId}`);
  }

  const seen = new Set<number>();
  return found.filter((s) => {
    const k = s.startTime || 0;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The answers in those plays. A play pays only when every question is
 * right; its points are split evenly between its questions.
 */
export async function olderAnswers(userId: string): Promise<HistoryEntry[]> {
  const out: HistoryEntry[] = [];
  try {
    for (const s of await allSessions(userId)) {
      const won = s.status === 'completed' && s.questions.every((q) => q.correct === true);
      const total = won && s.potentialPoints ? s.potentialPoints : 0;
      const each = total > 0 ? total / s.questions.length : 0;
      s.questions.forEach((q, i) => {
        if (q.userAnswer === undefined) return;
        out.push({
          question: { ...q, mode: 'casino-rush', pointMultiplier: 3 },
          selectedAnswer: q.userAnswer,
          correct: q.correct || false,
          timestamp: new Date(q.answeredAt || s.lastPlayedAt || Date.now()).toISOString(),
          pointsEarned: q.correct && won ? each : 0,
          isCasinoRush: true,
          questionNumber: i + 1,
          totalQuestions: s.questions.length,
        } as HistoryEntry);
      });
    }
  } catch {
    logger.debug(`No Casino Rush history for user ${userId} or error reading it`);
  }
  return out;
}
