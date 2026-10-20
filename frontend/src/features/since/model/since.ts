/**
 * Welcome back (docs/decisions/0016): after a while away, what's new since,
 * in one line. Never what was missed; asked once as Home opens.
 */
import type { SinceSummary } from '@family-trivia/shared';
import { useCircleQuery } from '../../../shared/api/query';

const names = (ids: string[], nameOf: (id: string) => string) =>
  ids.length <= 2
    ? ids.map(nameOf).join(' and ')
    : `${ids.slice(0, 2).map(nameOf).join(', ')} and ${ids.length - 2} more`;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The welcome-back line, or null when there's nothing to say. */
export function sinceLine(
  since: SinceSummary | null,
  nameOf: (id: string) => string,
): string | null {
  if (!since?.since) return null;
  const onYours = [
    since.comments ? plural(since.comments, 'comment') : null,
    since.reactions ? plural(since.reactions, 'reaction') : null,
  ].filter(Boolean);
  const parts = [
    since.answeredBy.length ? `${names(since.answeredBy, nameOf)} shared answers` : null,
    onYours.length ? `${onYours.join(' and ')} on yours` : null,
  ].filter(Boolean);
  const day = new Date(since.since).toLocaleDateString(undefined, { weekday: 'long' });
  return parts.length ? `Since ${day}: ${parts.join(' · ')}.` : 'Good to see you.';
}

/** Asked once while the app is open: asking also notes that I'm here now. */
export function useSince(): SinceSummary | null {
  return (
    useCircleQuery({ key: ['since'], path: '/me/since', method: 'post', once: true }).data ?? null
  );
}
