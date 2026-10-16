/**
 * Reactions: one tap on someone's answer or family fact, so a family can
 * answer each other without having to find words. One reaction per person
 * per item; tapping it again takes it back.
 */

export const REACTIONS = [
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'laugh', emoji: '😂', label: 'Ha' },
  { id: 'same', emoji: '🙋', label: 'Me too' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'hug', emoji: '🫂', label: 'Hug' },
] as const;

export type ReactionId = (typeof REACTIONS)[number]['id'];
export type ReactableType = 'fact' | 'trivia';

export const isReactionId = (v: unknown): v is ReactionId =>
  typeof v === 'string' && REACTIONS.some((r) => r.id === v);

export const reactionById = (id: ReactionId) => REACTIONS.find((r) => r.id === id) ?? REACTIONS[0];

/** What one item's reactions look like to the person reading. */
export interface ReactionSummary {
  /** Who reacted with what, newest first. */
  by: { userId: string; reaction: ReactionId }[];
  mine: ReactionId | null;
}

/** As stored: reactions/{type}/{contentId}.json */
export interface ReactionRecord {
  byUser: Record<string, { reaction: ReactionId; at: string }>;
}

/** Fact and trivia ids are "{ownerId}_{timestamp}". */
export const ownerOf = (contentId: string): string | null => {
  const i = contentId.indexOf('_');
  return i > 0 ? contentId.slice(0, i) : null;
};

/** Count per reaction, most used first. */
export const tally = (s: ReactionSummary) => {
  const counts = new Map<ReactionId, number>();
  for (const b of s.by) counts.set(b.reaction, (counts.get(b.reaction) ?? 0) + 1);
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([id, n]) => ({ ...reactionById(id), count: n }));
};
