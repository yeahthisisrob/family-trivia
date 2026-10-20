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

/** Who has played trivia: a trivia answer or a round changes it. */
export const TRIVIA_GRID = [...WHO_HAS_PLAYED, 'trivia'] as const;

export const useAnswerGrid = (userId: string) =>
  useCircleQuery({ key: TRIVIA_GRID, path: '/answer-grid', query: { userId } });
