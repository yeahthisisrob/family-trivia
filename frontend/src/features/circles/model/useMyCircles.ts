import type { MyCircle } from '@family-trivia/shared';
import { useCallback, useEffect, useState } from 'react';
import {
  currentCircleId,
  enterCircle,
  loadCircles,
  loadSession,
  saveCircles,
} from '../../../session';
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
        const here = circles.find((c) => c.id === current);
        const me = loadSession();
        // Another circle, or another person in it, than this tab opened as:
        // start over there rather than mix two circles on one screen.
        const tabs = currentCircleId();
        if (here && ((me && me !== here.userId) || (tabs && current !== tabs))) {
          enterCircle(here, circles);
          return;
        }
        saveCircles(current, circles);
        setState({ current, circles });
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
