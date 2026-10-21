import type { ThreadAnswer, ThreadProgress, ThreadsToday } from '@family-trivia/shared';
import { useState } from 'react';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { threadsApi } from '../api/threadsApi';

export interface Tied {
  name: string;
  label: string;
  progress: ThreadProgress;
}

/** Every thread read: a season's change changes what is asked. */
export const THREADS = ['threads'] as const;
const TODAY = [...THREADS, 'today'] as const;

/** Today's thread, and what happened when it was answered. */
export function useThreads() {
  const today = useCircleQuery({ key: TODAY, path: '/threads/today' });
  const [tied, setTied] = useState<Tied | null>(null);
  const tie = useCircleMutation({
    mutationFn: (a: ThreadAnswer) => threadsApi.answer(a),
    // Answered: nothing more to ask today.
    onSuccess: (r, _a, cache) =>
      cache.set<ThreadsToday>(TODAY, () => ({ question: null, progress: r.progress })),
  });

  const answer = async (a: ThreadAnswer) => {
    const q = today.data?.question;
    if (!q) return;
    const r = await tie.mutateAsync(a);
    setTied({
      name: q.about.name,
      label: q.choices.find((c) => c.id === a.choice)?.label ?? '',
      progress: r.progress,
    });
  };

  return { today: today.data ?? null, tied, answer };
}
