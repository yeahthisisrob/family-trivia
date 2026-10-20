import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { loadCircles } from '../../../shared/session/session';
import { type SharedFrom, sharingApi } from '../api/sharingApi';

/** Whether this tab is in a joined circle: only there do past answers come from elsewhere. */
export const inJoinedCircle = (): boolean => {
  const c = loadCircles();
  return !!c?.circles.find((x) => x.id === c.current)?.sources?.length;
};

const KEY = ['sharing'] as const;
type Sharing = { from: SharedFrom[] };

const flip =
  (circleId: string, on: boolean) =>
  (current: Sharing | undefined): Sharing | undefined =>
    current && {
      from: current.from.map((f) => (f.circleId === circleId ? { ...f, shared: on } : f)),
    };

/**
 * The caller's past-answer choices here. A switch shows at once and is put
 * back if saving fails.
 */
export function useSharing(enabled = inJoinedCircle()) {
  const asked = useCircleQuery({ key: KEY, path: '/me/sharing', enabled });
  const save = useCircleMutation({
    mutationFn: ({ circleId, shared }: { circleId: string; shared: boolean }) =>
      sharingApi.set(circleId, shared),
    onMutate: ({ circleId, shared }, cache) => {
      cache.set(KEY, flip(circleId, shared));
      return () => cache.set(KEY, flip(circleId, !shared));
    },
    onSuccess: (saved, _vars, cache) => cache.set<Sharing>(KEY, () => saved),
  });

  return {
    from: asked.data?.from ?? null,
    failed: asked.isError || save.isError,
    set: (circleId: string, shared: boolean) => save.mutate({ circleId, shared }),
  };
}
