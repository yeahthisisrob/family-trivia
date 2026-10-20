import type { AfterPlan, Rsvp } from '@family-trivia/shared';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { plansApi } from '../api/plansApi';

const VIEW = ['plans', 'view'] as const;
const AFTER = ['plans', 'after'] as const;

/** The weeks ahead, and the three things people do with them. */
export function usePlans() {
  const view = useCircleQuery({ key: VIEW, path: '/plans' });
  // Each change brings the weeks back from the server before it resolves.
  const dropIn = useCircleMutation({
    mutationFn: (text: string) => plansApi.dropIn(text),
    invalidates: [VIEW],
  });
  const remove = useCircleMutation({
    mutationFn: (id: string) => plansApi.remove(id),
    invalidates: [VIEW],
  });
  const rsvp = useCircleMutation({
    mutationFn: ({ id, answer }: { id: string; answer: Rsvp | null }) => plansApi.rsvp(id, answer),
    invalidates: [VIEW],
  });
  return {
    view: view.data ?? null,
    dropIn: async (text: string) => (await dropIn.mutateAsync(text)).added,
    remove: async (id: string) => {
      await remove.mutateAsync(id);
    },
    rsvp: async (id: string, answer: Rsvp | null) => {
      await rsvp.mutateAsync({ id, answer });
    },
  };
}

/** Plans that just happened, asking how they went; the server answers each change with the list. */
export function useAfterPlans() {
  const after = useCircleQuery({ key: AFTER, path: '/plans/after', select: (r) => r.plans });
  const remember = useCircleMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => plansApi.remember(id, text),
    onSuccess: (plans, _vars, cache) => cache.set<{ plans: AfterPlan[] }>(AFTER, () => ({ plans })),
  });
  const skip = useCircleMutation({
    mutationFn: (id: string) => plansApi.skip(id),
    onSuccess: (plans, _vars, cache) => cache.set<{ plans: AfterPlan[] }>(AFTER, () => ({ plans })),
  });
  return {
    plans: after.data ?? [],
    remember: async (id: string, text: string) => {
      await remember.mutateAsync({ id, text });
    },
    skip: async (id: string) => {
      await skip.mutateAsync(id);
    },
  };
}
