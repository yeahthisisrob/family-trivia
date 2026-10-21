/**
 * Circles as server data (docs/decisions/0035, 0015, 0018): the circles this
 * sign-in belongs to (the circle menu), every circle for the deployment's
 * owner, and who might be the same person in a joined circle. Starting,
 * joining or splitting a circle asks again for both lists, so the new circle
 * shows in Admin › Circles and in the circle menu at once. None of it is
 * retried or shown before the server has it.
 */
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { circlesApi, type SameSuggestion } from '../api/circlesApi';

const CIRCLES = ['circles'] as const;
const MY_CIRCLES = [...CIRCLES, 'mine'] as const;
const ALL_CIRCLES = [...CIRCLES, 'all'] as const;
const SAME = (circleId: string) => [...CIRCLES, 'same', circleId] as const;

export const useMyCirclesRead = () => useCircleQuery({ key: MY_CIRCLES, path: '/me/circles' });

/** Every circle, when the caller is the owner; null for anyone else. */
export const useAllCircles = () =>
  useCircleQuery({
    key: ALL_CIRCLES,
    path: '/admin/circles',
    select: (answer) => (answer.owner ? answer.circles : null),
  });

/** In a joined circle that hasn't ended: who might be one person. */
export const useSameSuggestions = (circleId: string, enabled: boolean) =>
  useCircleQuery({
    key: SAME(circleId),
    path: '/admin/circles/same',
    query: { circleId },
    enabled,
    select: (answer) => answer.suggestions,
  });

export const useAnswerSame = (circleId: string) =>
  useCircleMutation({
    mutationFn: ({ s, same }: { s: SameSuggestion; same: boolean }) =>
      circlesApi.answerSame(circleId, s, same),
    onSuccess: (left, _vars, cache) => cache.set(SAME(circleId), () => left),
  });

export const useStartCircle = () =>
  useCircleMutation({ mutationFn: circlesApi.create, invalidates: [CIRCLES] });

export const useJoinCircles = () =>
  useCircleMutation({ mutationFn: circlesApi.joinCircles, invalidates: [CIRCLES] });

/** Ends a joined circle; nothing is deleted. Asked for first (SplitDialog). */
export const useSplitCircle = () =>
  useCircleMutation({ mutationFn: circlesApi.split, invalidates: [CIRCLES] });

/** Join one more circle with a passphrase; the caller opens it. */
export const useJoinWithPassphrase = () =>
  useCircleMutation({ mutationFn: circlesApi.join, invalidates: [MY_CIRCLES] });
