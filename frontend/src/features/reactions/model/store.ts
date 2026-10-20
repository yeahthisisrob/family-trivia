/**
 * Reactions for everything on screen, as server data (docs/decisions/0035):
 * each bar reads its own item, cached in the tab's circle, and the bars that
 * ask in the same moment are answered by one request (reactionsApi). A tap
 * shows at once and is put back if the save fails.
 */
import type { ReactableType, ReactionId, ReactionSummary } from '@family-trivia/shared';
import { useCallback } from 'react';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { NO_REACTIONS, type Reactions, reactionsApi } from '../api/reactionsApi';

/** What the viewer's tap does to a summary, before the server says so. */
export function applyTap(s: ReactionSummary, me: string, reaction: ReactionId): ReactionSummary {
  const others = s.by.filter((b) => b.userId !== me);
  return s.mine === reaction
    ? { by: others, mine: null }
    : { by: [{ userId: me, reaction }, ...others], mine: reaction };
}

interface Tap {
  before: ReactionSummary;
  next: ReactionSummary;
}

export function useReactions(type: ReactableType, id: string, me: string) {
  const key = ['reactions', type, id] as const;
  const summary =
    useCircleQuery({
      key,
      path: '/reactions',
      read: (circle) => reactionsApi.get(circle, type, id),
      select: (r) => r.reactions[id] ?? NO_REACTIONS,
    }).data ?? NO_REACTIONS;

  const show = (s: ReactionSummary) => (current: Reactions | undefined) => ({
    reactions: { ...current?.reactions, [id]: s },
  });
  const save = useCircleMutation({
    mutationFn: ({ next }: Tap) => reactionsApi.set(type, id, next.mine),
    onMutate: ({ before, next }, cache) => {
      cache.set(key, show(next));
      return () => cache.set(key, show(before));
    },
    onSuccess: (r, _tap, cache) => cache.set(key, show(r.summary)),
  });

  const { mutate } = save;
  const tap = useCallback(
    (reaction: ReactionId) => mutate({ before: summary, next: applyTap(summary, me, reaction) }),
    [mutate, summary, me],
  );

  return { summary, tap };
}
