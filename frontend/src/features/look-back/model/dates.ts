import type { SeasonReview } from '@family-trivia/shared';
import { monthName } from '../../../shared/dates';

/** "May 2025 to July 2025", or the start alone while a season runs. */
export function seasonDates(s: SeasonReview['season']): string {
  const from = monthName(s.startDate);
  if (!s.endDate) return `Since ${from}`;
  const to = monthName(s.endDate);
  return from === to ? from : `${from} to ${to}`;
}
