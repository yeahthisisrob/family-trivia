/**
 * Who has played, as server data (docs/decisions/0035): one row per person,
 * one cell per question, for the week's questions and for trivia.
 */
import type { ResponseOf } from '../../../shared/api/contract';
import { useCircleQuery } from '../../../shared/api/query';

export type StatusGrid = ResponseOf<'/fact-grid'>;

const WHO_HAS_PLAYED = ['who-has-played'] as const;
export const FACT_GRID = [...WHO_HAS_PLAYED, 'facts'] as const;

export const useFactGrid = (userId: string) =>
  useCircleQuery({ key: FACT_GRID, path: '/fact-grid', query: { userId } });

/**
 * Trivia answers are saved by the Trivia tab, which hasn't moved to server
 * data yet (0035, step 3): its `refreshTimestamp` asks again, keeping the
 * grid on screen while it does.
 */
export const useAnswerGrid = (userId: string, refreshTimestamp: number) =>
  useCircleQuery({
    key: [...WHO_HAS_PLAYED, 'trivia', refreshTimestamp],
    path: '/answer-grid',
    query: { userId },
    keepPrevious: true,
  });
