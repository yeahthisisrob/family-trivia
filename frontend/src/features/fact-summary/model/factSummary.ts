/**
 * A week's answers (or, before weekly questions, a day's), summed up by the
 * server, as server data (docs/decisions/0035).
 */
import { callApi } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';

/** Invalidate after an answer: a week with no summary yet is summed up again. */
export const FACT_SUMMARY = ['fact-summary'] as const;

const dateOf = (date: string, weekly: boolean): Record<string, string> =>
  weekly ? { weekStart: date } : { date };

export const useFactSummary = (date: string, weekly: boolean, enabled: boolean) =>
  useCircleQuery({
    key: [...FACT_SUMMARY, date, weekly],
    path: '/daily-fact-summary',
    query: dateOf(date, weekly),
    enabled,
  });

interface Regenerate {
  date: string;
  weekly: boolean;
}

/** Write the summary again; its answer replaces the one on screen. */
export const useRegenerateSummary = () =>
  useCircleMutation({
    mutationFn: ({ date, weekly }: Regenerate) =>
      callApi('/daily-fact-summary', { query: { ...dateOf(date, weekly), forceGenerate: 'true' } }),
    onSuccess: (summary, { date, weekly }, cache) =>
      cache.set([...FACT_SUMMARY, date, weekly], () => summary),
  });
