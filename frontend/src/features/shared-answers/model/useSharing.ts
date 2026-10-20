import { useCallback, useEffect, useState } from 'react';
import { loadCircles } from '../../../session';
import { type SharedFrom, sharingApi } from '../api/sharingApi';

/** Whether this tab is in a joined circle: only there do past answers come from elsewhere. */
export const inJoinedCircle = (): boolean => {
  const c = loadCircles();
  return !!c?.circles.find((x) => x.id === c.current)?.sources?.length;
};

/**
 * The caller's past-answer choices here. A switch shows at once and is put
 * back if saving fails.
 */
export function useSharing(enabled = inJoinedCircle()) {
  const [from, setFrom] = useState<SharedFrom[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    sharingApi
      .get()
      .then((r) => setFrom(r.from))
      .catch(() => setFailed(true));
  }, [enabled]);

  const set = useCallback(async (circleId: string, shared: boolean) => {
    const flip = (on: boolean) => (list: SharedFrom[] | null) =>
      list?.map((f) => (f.circleId === circleId ? { ...f, shared: on } : f)) ?? null;
    setFrom(flip(shared));
    try {
      setFrom((await sharingApi.set(circleId, shared)).from);
    } catch {
      setFrom(flip(!shared));
      setFailed(true);
    }
  }, []);

  return { from, failed, set };
}
