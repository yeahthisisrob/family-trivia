/**
 * The circle's dates, as server data (docs/decisions/0035). Adding or
 * deleting one asks every celebrations read again: the strip on Home and the
 * full list.
 */
import type { Celebration } from '@family-trivia/shared';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { celebrationsApi } from '../api/celebrationsApi';

const CELEBRATIONS = ['celebrations'] as const;

/** By month, then day (dates are MM/DD). */
const byDate = (a: Celebration, b: Celebration) => {
  const [am = 0, ad = 0] = a.date.split('/').map(Number);
  const [bm = 0, bd = 0] = b.date.split('/').map(Number);
  return am !== bm ? am - bm : ad - bd;
};

/**
 * Today's dates and the next `limit`, asked for one more to tell whether
 * there are more. A longer list keeps the shorter one on screen while it loads.
 */
export const useUpcomingDates = (limit: number, enabled: boolean) =>
  useCircleQuery({
    key: [...CELEBRATIONS, 'upcoming'],
    path: '/upcoming-birthdays',
    query: { limit: limit + 1 },
    enabled,
    keepPrevious: true,
  });

/** Every date in the year, in calendar order. */
export const useAllCelebrations = (enabled: boolean) =>
  useCircleQuery({
    key: [...CELEBRATIONS, 'all'],
    path: '/celebrations',
    enabled,
    select: (r) => [...r.celebrations].sort(byDate),
  });

export const useAddCelebration = () =>
  useCircleMutation({ mutationFn: celebrationsApi.add, invalidates: [CELEBRATIONS] });

export const useRemoveCelebration = () =>
  useCircleMutation({
    mutationFn: (id: string) => celebrationsApi.remove(id),
    invalidates: [CELEBRATIONS],
  });
