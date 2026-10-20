import type { MyCircle } from '@family-trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  currentCircleId,
  enterCircle,
  loadCircles,
  loadSession,
  saveCircles,
} from '../../../shared/session/session';
import { circlesApi } from '../api/circlesApi';

export interface MyCircles {
  circles: MyCircle[];
  current: MyCircle | null;
  /** Join one more circle with a passphrase and open it. */
  join: (passphrase: string) => Promise<void>;
  open: (circle: MyCircle) => void;
}

/**
 * The circles this sign-in belongs to. Starts from what the browser
 * remembers, then checks with the server: it decides which circle a request
 * is in, so if the person here isn't who they are in that circle (an old
 * session, a circle they were removed from), the app restarts as the right
 * person.
 */
export function useMyCircles(): MyCircles {
  const [state, setState] = useState(() => loadCircles());

  useEffect(() => {
    let live = true;
    circlesApi
      .mine()
      .then(({ circles, current }) => {
        if (!live) return;
        // This tab stays in the circle it opened in (the server answers for
        // the one each request names); a first visit takes the server's.
        const pinned = currentCircleId();
        const mineHere = pinned && circles.some((c) => c.id === pinned) ? pinned : current;
        const here = circles.find((c) => c.id === mineHere);
        const me = loadSession();
        // Someone else in it than this tab opened as: start over as them.
        if (here && me && me !== here.userId) {
          enterCircle(here, circles);
          return;
        }
        saveCircles(mineHere, circles);
        setState({ current: mineHere, circles });
      })
      .catch(() => {
        /* offline or signed out: keep what we had */
      });
    return () => {
      live = false;
    };
  }, []);

  const circles = state?.circles ?? [];
  const current = circles.find((c) => c.id === state?.current) ?? null;

  const join = useCallback(async (passphrase: string) => {
    const r = await circlesApi.join(passphrase);
    const joined = r.circles.find((c) => c.id === r.joined);
    if (joined) enterCircle(joined, r.circles);
  }, []);

  const open = useCallback((circle: MyCircle) => enterCircle(circle, circles), [circles]);

  return { circles, current, join, open };
}
