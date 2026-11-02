import type { AfterPlan, Rsvp } from '@family-trivia/shared';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { type EventInput, plansApi, type RsvpBody } from '../api/plansApi';

const PLANS = ['plans'] as const;
const VIEW = [...PLANS, 'view'] as const;
const AFTER = [...PLANS, 'after'] as const;
const EVENT = [...PLANS, 'event'] as const;
const AUDIENCE = [...PLANS, 'audience'] as const;

/** The weeks ahead, and the three things people do with them. */
export function usePlans() {
  const view = useCircleQuery({ key: VIEW, path: '/plans' });
  // Each change brings the weeks back from the server before it resolves.
  const dropIn = useQuickAdd();
  const remove = useCircleMutation({
    mutationFn: (id: string) => plansApi.remove(id),
    invalidates: [VIEW],
  });
  const rsvp = useRsvp();
  return {
    view: view.data ?? null,
    dropIn,
    remove: async (id: string) => {
      await remove.mutateAsync(id);
    },
    rsvp: (id: string, answer: Rsvp | null) => rsvp({ id, answer }),
  };
}

/** The days of a calendar month (its whole weeks): plans and events on each, as the caller sees them. */
export const useCalendar = (from: string, to: string) =>
  useCircleQuery({
    key: [...VIEW, 'range'],
    path: '/plans',
    query: { from, to },
    keepPrevious: true,
  });

/** Say it in a sentence; the AI reads it into days (the same reader as What's on). */
export function useQuickAdd() {
  const add = useCircleMutation({
    mutationFn: (text: string) => plansApi.dropIn(text),
    invalidates: [VIEW],
  });
  return async (text: string) => (await add.mutateAsync(text)).added;
}

/** Answer a plan or event; the weeks ahead and the event's page both ask again. */
export function useRsvp() {
  const rsvp = useCircleMutation({
    mutationFn: (body: RsvpBody) => plansApi.rsvp(body),
    invalidates: [VIEW, EVENT],
  });
  return async (body: RsvpBody) => {
    await rsvp.mutateAsync(body);
  };
}

/** One event as the caller sees it: who's invited, the answers, whether they can change it. */
export const useEvent = (id: string | null) =>
  useCircleQuery({
    key: [...EVENT, id],
    path: '/plans/events',
    query: { id: id ?? '' },
    enabled: !!id,
    select: (r) => r.event,
  });

/** The circles the caller can share with, and who's in each (for the form). */
export const useAudience = (enabled: boolean) =>
  useCircleQuery({
    key: AUDIENCE,
    path: '/plans/events/audience',
    enabled,
    select: (r) => r.circles,
  });

/** Make an event, or change one (with its id); resolves with it once the weeks ahead have it. */
export function useSaveEvent() {
  const save = useCircleMutation({
    mutationFn: ({ id, input }: { id?: string; input: EventInput }) =>
      id ? plansApi.updateEvent(id, input) : plansApi.createEvent(input),
    invalidates: [VIEW, EVENT],
  });
  return (input: EventInput, id?: string) => save.mutateAsync({ id, input });
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
