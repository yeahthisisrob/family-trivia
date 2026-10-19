import type { Drop, PlansView, Rsvp } from '@family-trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import { plansApi } from '../api/plansApi';

/** The weeks ahead, and the three things people do with them. */
export function usePlans() {
  const [view, setView] = useState<PlansView | null>(null);
  const reload = useCallback(() => plansApi.view().then(setView), []);

  useEffect(() => {
    reload().catch(() => setView(null));
  }, [reload]);

  const dropIn = useCallback(
    async (text: string): Promise<Drop[]> => {
      const { added } = await plansApi.dropIn(text);
      await reload();
      return added;
    },
    [reload],
  );
  const remove = useCallback(
    async (id: string) => {
      await plansApi.remove(id);
      await reload();
    },
    [reload],
  );
  const rsvp = useCallback(
    async (id: string, answer: Rsvp | null) => {
      await plansApi.rsvp(id, answer);
      await reload();
    },
    [reload],
  );
  return { view, dropIn, remove, rsvp };
}
