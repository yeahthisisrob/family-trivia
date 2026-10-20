/**
 * Rounds (docs/decisions/0032): any game, once a week, sets a multiplier;
 * then one trivia question, worth that many points. The rules are the same
 * for every game (ROUND_RULES), so a game needs nothing here to have one.
 */
import { type HistoryEntry, ROUND_RULES } from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { getAvailableCategories } from '../../routes/game-modes/shared';
// Question writing is shared with the daily question; it lives with those routes.
import { generateQuestionWithOptions } from '../../routes/questionGeneration/shared';
import { submitScore } from '../../services/arcadeService';
import { canPlayGameMode, canPlayGameModeAny } from '../../services/gameModeService';
import { logger } from '../../services/logger';
import { deleteObject, getJson, putJson } from '../../services/s3';

interface Round {
  game: string;
  multiplier: number;
  newBest: boolean;
  catchUp: boolean;
  question: {
    question: string;
    choices: string[];
    answer: string;
    category: string;
    difficulty: 'easy' | 'normal' | 'hard';
  };
  startedAt: string;
}

// One round at a time per player: starting another replaces it.
const roundKey = (userId: string) => `games/rounds/${userId}.json`;

type Result<T> =
  | { ok: true; value: T }
  | { ok: false; status: number; error: string; code?: string; details?: string };

const BLOCKED: Record<string, string> = {
  cooldown: 'Played this week already',
  end_of_season: 'Season has ended',
  no_catchup_available: 'No catch-up available',
  daily_limit_reached: 'Daily question limit reached',
  no_trivia_this_season: 'No trivia this season',
};

/** Which of these games can be played as a round now, and when the rest can. */
export async function roundStatus(userId: string, games: string[]) {
  const all = await Promise.all(
    games.map(async (g) => {
      const s = await canPlayGameModeAny(userId, g);
      return [g, { canPlay: s.canPlay, nextAvailable: s.nextAvailable?.toISOString() ?? null }];
    }),
  );
  return Object.fromEntries(all) as Record<
    string,
    { canPlay: boolean; nextAvailable: string | null }
  >;
}

/** The game is over: keep its multiplier (and score), and ask the question. */
export async function lockRound(
  userId: string,
  r: { game: string; multiplier: number; score?: number; catchUp: boolean },
): Promise<
  Result<{
    multiplier: number;
    question: Omit<Round['question'], 'answer' | 'difficulty'>;
    newBest: boolean;
  }>
> {
  if (!ROUND_RULES.multipliers.includes(r.multiplier))
    return {
      ok: false,
      status: 400,
      error: `multiplier must be one of ${ROUND_RULES.multipliers.join(', ')}`,
    };

  const gate = await canPlayGameMode(userId, r.game, r.catchUp ? 'catchup' : r.game);
  if (!gate.canPlay) {
    const code = gate.blockedReason ?? 'cooldown';
    return {
      ok: false,
      status: 403,
      error: BLOCKED[code] ?? 'Not now',
      code,
      details: gate.nextAvailable?.toISOString(),
    };
  }

  const newBest =
    typeof r.score === 'number'
      ? (await submitScore(r.game, userId, Math.round(r.score), 'trivia')).isNewHighScore
      : false;

  const categories = await getAvailableCategories(userId);
  const category = categories[Math.floor(Math.random() * categories.length)];
  if (!category) return { ok: false, status: 500, error: 'No categories available' };

  let q: Awaited<ReturnType<typeof generateQuestionWithOptions>>['question'];
  try {
    q = (
      await generateQuestionWithOptions({
        userId,
        mode: 'category',
        category,
        difficulty: 'normal',
        withProgress: false,
      })
    ).question;
  } catch (err) {
    logger.error('Round question failed', {
      userId,
      game: r.game,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, status: 500, error: 'Failed to generate question' };
  }

  const round: Round = {
    game: r.game,
    multiplier: r.multiplier,
    newBest,
    catchUp: r.catchUp,
    question: {
      question: q.question,
      choices: q.choices,
      answer: q.answer,
      category: q.category || category,
      difficulty: (q.difficulty as Round['question']['difficulty']) || 'normal',
    },
    startedAt: new Date().toISOString(),
  };
  await putJson(roundKey(userId), round);
  const { question, choices } = round.question;
  return {
    ok: true,
    value: {
      multiplier: r.multiplier,
      question: { question, choices, category: round.question.category },
      newBest,
    },
  };
}

/** Score the answer: the multiplier if right, plus the bonus for a new best. */
export async function answerRound(
  userId: string,
  game: string,
  answer: string,
): Promise<
  Result<{
    correct: boolean;
    correctAnswer: string;
    pointsEarned: number;
    multiplier: number;
    newBestBonus: number;
  }>
> {
  const round = await getJson<Round>(roundKey(userId));
  if (!round || round.game !== game) return { ok: false, status: 400, error: 'No round to answer' };

  const correct = answer.trim().toLowerCase() === round.question.answer.trim().toLowerCase();
  const newBestBonus = round.newBest ? ROUND_RULES.newBestBonus : 0;
  const pointsEarned = correct ? round.multiplier + newBestBonus : 0;

  const key = S3_PATHS.ANSWER_HISTORY(userId);
  const history = (await getJson<HistoryEntry[]>(key)) ?? [];
  history.push({
    question: { ...round.question, pointMultiplier: round.multiplier },
    selectedAnswer: answer,
    correct,
    timestamp: new Date().toISOString(),
    pointsEarned,
    gameMode: game,
    multiplier: round.multiplier,
    ...(round.catchUp && { isCatchingUp: true }),
  });
  await putJson(key, history);
  await deleteObject(roundKey(userId)).catch(() => undefined);

  logger.info('Round answered', { userId, game, correct, pointsEarned });
  return {
    ok: true,
    value: {
      correct,
      correctAnswer: round.question.answer,
      pointsEarned,
      multiplier: round.multiplier,
      newBestBonus,
    },
  };
}
