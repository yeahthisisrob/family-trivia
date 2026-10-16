/**
 * Reactions storage: one small file per item, and an inbox per person so
 * their notifications can say who reacted without reading every item.
 */
import {
  ownerOf,
  type ReactableType,
  type ReactionId,
  type ReactionRecord,
  type ReactionSummary,
} from '@family-trivia/shared';
import { getJson, putJson } from './s3';

const itemKey = (type: ReactableType, id: string) => `reactions/${type}/${id}.json`;
const inboxKey = (userId: string) => `reactions/inbox/${userId}.json`;
const INBOX_LIMIT = 100;

export interface InboxEntry {
  type: ReactableType;
  contentId: string;
  userId: string;
  reaction: ReactionId;
  at: string;
}

export const readRecord = async (type: ReactableType, id: string): Promise<ReactionRecord> =>
  (await getJson<ReactionRecord>(itemKey(type, id))) ?? { byUser: {} };

export function summarize(record: ReactionRecord, viewer: string): ReactionSummary {
  const by = Object.entries(record.byUser)
    .sort((a, b) => b[1].at.localeCompare(a[1].at))
    .map(([userId, r]) => ({ userId, reaction: r.reaction }));
  return { by, mine: record.byUser[viewer]?.reaction ?? null };
}

/**
 * Set the viewer's reaction, or take it back when it's the one they already
 * have (or `null`). The owner hears about new reactions, never their own.
 */
export async function react(
  type: ReactableType,
  id: string,
  userId: string,
  reaction: ReactionId | null,
  now = new Date().toISOString(),
): Promise<ReactionRecord> {
  const record = await readRecord(type, id);
  const current = record.byUser[userId]?.reaction ?? null;
  if (reaction === null || reaction === current) delete record.byUser[userId];
  else record.byUser[userId] = { reaction, at: now };
  await putJson(itemKey(type, id), record);

  const owner = ownerOf(id);
  const added = record.byUser[userId];
  if (owner && owner !== userId && added) {
    const inbox = (await getJson<InboxEntry[]>(inboxKey(owner))) ?? [];
    const rest = inbox.filter((e) => !(e.contentId === id && e.userId === userId));
    await putJson(
      inboxKey(owner),
      [{ type, contentId: id, userId, reaction: added.reaction, at: now }, ...rest].slice(
        0,
        INBOX_LIMIT,
      ),
    );
  }
  return record;
}

export const readInbox = async (userId: string): Promise<InboxEntry[]> =>
  (await getJson<InboxEntry[]>(inboxKey(userId))) ?? [];
