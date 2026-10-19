import type { ThreadAnswer, ThreadProgress, ThreadsToday } from '@family-trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import { threadsApi } from '../api/threadsApi';

export interface Tied {
  name: string;
  label: string;
  progress: ThreadProgress;
}

/** Today's thread, and what happened when it was answered. */
export function useThreads() {
  const [today, setToday] = useState<ThreadsToday | null>(null);
  const [tied, setTied] = useState<Tied | null>(null);

  useEffect(() => {
    threadsApi
      .today()
      .then(setToday)
      .catch(() => setToday(null));
  }, []);

  const answer = useCallback(
    async (a: ThreadAnswer) => {
      const q = today?.question;
      if (!q) return;
      const r = await threadsApi.answer(a);
      setTied({
        name: q.about.name,
        label: q.choices.find((c) => c.id === a.choice)?.label ?? '',
        progress: r.progress,
      });
      setToday({ question: null, progress: r.progress });
    },
    [today],
  );

  return { today, tied, answer };
}
