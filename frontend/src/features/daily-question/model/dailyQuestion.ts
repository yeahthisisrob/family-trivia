/**
 * Today's question, as server data (docs/decisions/0035): the question, the
 * answers its catch-up queue is built from, and the starters that help type
 * an answer. An answer or a skip shows at once; then everything on Home it
 * changes is asked for again: who has played, the week's answers, the
 * timeline, and this question itself.
 */
import {
  generateDailyFactWithTheme,
  skipDailyFact,
  submitDailyFact,
} from '../../../api/modules/facts';
import { TIMELINE } from '../../../entities/timeline';
import type { ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { FACT_SUMMARY } from '../../fact-summary';
import { FACT_GRID } from '../../who-has-played';

export type TodaysQuestion = ResponseOf<'/daily-fact'>;
export type FactHistory = ResponseOf<'/user-fact-history'>;

const DAILY_QUESTION = ['daily-question'] as const;

/** What an answer to today's question (or one waiting) changes on Home. */
const ANSWERED = [DAILY_QUESTION, FACT_GRID, FACT_SUMMARY, TIMELINE];

export const useTodaysQuestion = (userId: string) =>
  useCircleQuery({ key: [...DAILY_QUESTION, 'today'], path: '/daily-fact', query: { userId } });

/** Asked only when there may be a queue: not while today's question is still to be made. */
export const useFactHistory = (userId: string, enabled: boolean) =>
  useCircleQuery({
    key: [...DAILY_QUESTION, 'history'],
    path: '/user-fact-history',
    query: { userId, includeGlobal: 'true' },
    enabled,
  });

/** Opening phrases from the family's answers, for the answer box. */
export const useStarters = () =>
  useCircleQuery({
    key: [...DAILY_QUESTION, 'starters'],
    path: '/fact-suggestions',
    select: (r) => r.starters ?? [],
  });

interface Answer {
  userId: string;
  question: string;
  answer: string;
  catchup: boolean;
}

export const useSubmitAnswer = () =>
  useCircleMutation({
    mutationFn: ({ userId, question, answer, catchup }: Answer) =>
      submitDailyFact(userId, question, answer, catchup),
    invalidates: ANSWERED,
    refreshInBackground: true,
  });

export const useSkipQuestion = () =>
  useCircleMutation({
    mutationFn: ({ userId, question, catchup }: Omit<Answer, 'answer'>) =>
      skipDailyFact(userId, question, catchup),
    invalidates: ANSWERED,
    refreshInBackground: true,
  });

/** Today's creator picks the question everyone gets. */
export const useChooseQuestion = () =>
  useCircleMutation({
    mutationFn: ({ userId, question }: { userId: string; question: string }) =>
      generateDailyFactWithTheme(userId, question, false),
    invalidates: [DAILY_QUESTION],
    refreshInBackground: true,
  });
