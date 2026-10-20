/**
 * Since you were last here (docs/decisions/0016). A visit after more than a
 * day and a half away returns what's new since then, once; a quick return
 * returns nothing. Stored: when they were last here (seen/{userId}.json).
 */
import type { SinceSummary } from '@family-trivia/shared';
import { getAllFactHistories } from '../../services/factHistoryService';
import { getNotifications } from '../../services/notificationService';
import { getJson, putJson } from '../../services/s3';

const KEY = (userId: string) => `seen/${userId}.json`;
/** Away at least this long before there's anything to say. */
const AWAY_MS = 36 * 60 * 60 * 1000;

export async function sinceLastVisit(me: string, now = new Date()): Promise<SinceSummary> {
  const last = (await getJson<{ at: string }>(KEY(me)))?.at ?? null;
  await putJson(KEY(me), { at: now.toISOString() });
  const empty: SinceSummary = { since: null, answeredBy: [], comments: 0, reactions: 0 };
  if (!last || now.getTime() - Date.parse(last) < AWAY_MS) return empty;

  const [histories, notes] = await Promise.all([getAllFactHistories(), getNotifications(me)]);
  const answeredBy = [...histories.entries()]
    .filter(([id, entries]) => id !== me && entries.some((e) => e.answered && e.timestamp > last))
    .map(([id]) => id);
  const after = notes.items.filter((n) => n.timestamp > last);
  return {
    since: last,
    answeredBy,
    comments: after.filter((n) => n.type === 'comment').length,
    reactions: after.filter((n) => n.type === 'reaction').length,
  };
}
