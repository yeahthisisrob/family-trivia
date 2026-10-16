/**
 * Reactions for everything on screen, loaded together: each bar asks for its
 * item, and the asks made in the same moment go out as one request. A tap
 * shows at once and is put right if the save fails.
 */
import type { ReactableType, ReactionId, ReactionSummary } from '@family-trivia/shared';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { reactionsApi } from '../api/reactionsApi';

const EMPTY: ReactionSummary = { by: [], mine: null };
const key = (type: ReactableType, id: string) => `${type}:${id}`;

const cache = new Map<string, ReactionSummary>();
const asked = new Set<string>();
const pending: Record<ReactableType, Set<string>> = { fact: new Set(), trivia: new Set() };
const listeners = new Set<() => void>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const emit = () => {
  for (const l of listeners) l();
};

async function flush() {
  flushTimer = null;
  for (const type of ['fact', 'trivia'] as const) {
    const ids = [...pending[type]];
    pending[type].clear();
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      try {
        const { reactions } = await reactionsApi.get(type, batch);
        for (const id of batch) cache.set(key(type, id), reactions[id] ?? EMPTY);
      } catch {
        for (const id of batch) asked.delete(key(type, id)); // try again next time it shows
      }
    }
  }
  emit();
}

function request(type: ReactableType, id: string) {
  const k = key(type, id);
  if (asked.has(k)) return;
  asked.add(k);
  pending[type].add(id);
  if (!flushTimer) flushTimer = setTimeout(flush, 30);
}

/** Put a summary in the cache directly (stories, and the server's answer to a tap). */
export function primeReactions(type: ReactableType, id: string, summary: ReactionSummary) {
  asked.add(key(type, id));
  cache.set(key(type, id), summary);
  emit();
}

/** What the viewer's tap does to a summary, before the server says so. */
export function applyTap(s: ReactionSummary, me: string, reaction: ReactionId): ReactionSummary {
  const others = s.by.filter((b) => b.userId !== me);
  return s.mine === reaction
    ? { by: others, mine: null }
    : { by: [{ userId: me, reaction }, ...others], mine: reaction };
}

export function useReactions(type: ReactableType, id: string, me: string) {
  const k = key(type, id);
  useEffect(() => request(type, id), [type, id]);
  const summary = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => cache.get(k) ?? EMPTY,
  );

  const tap = useCallback(
    async (reaction: ReactionId) => {
      const before = cache.get(k) ?? EMPTY;
      const next = applyTap(before, me, reaction);
      primeReactions(type, id, next);
      try {
        const r = await reactionsApi.set(type, id, next.mine);
        primeReactions(type, id, r.summary);
      } catch {
        primeReactions(type, id, before);
      }
    },
    [k, type, id, me],
  );

  return { summary, tap };
}
