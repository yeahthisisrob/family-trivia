import type { MyCircle } from '@family-trivia/shared';
import { useCallback, useEffect } from 'react';
import {
  currentCircleId,
  enterCircle,
  loadCircles,
  loadSession,
  saveCircles,
} from '../../../shared/session/session';
import { useJoinWithPassphrase, useMyCirclesRead } from './circles';

export interface MyCircles {
  circles: MyCircle[];
  current: MyCircle | null;
  /** Join one more circle with a passphrase and open it. */
  join: (passphrase: string) => Promise<void>;
  open: (circle: MyCircle) => void;
}

/** This tab stays in the circle it opened in; a first visit takes the server's. */
const hereOf = (circles: MyCircle[], serverCurrent: string) => {
  const pinned = currentCircleId();
  return pinned && circles.some((c) => c.id === pinned) ? pinned : serverCurrent;
};

/**
 * The circles this sign-in belongs to. Starts from what the browser
 * remembers, then checks with the server (a query, docs/decisions/0035): it
 * decides which circle a request is in, so if the person here isn't who they
 * are in that circle (an old session, a circle they were removed from), the
 * app restarts as the right person.
 */
export function useMyCircles(): MyCircles {
  const answer = useMyCirclesRead().data;
  const { mutateAsync: joinWith } = useJoinWithPassphrase();

  // What the server says is remembered for the next visit, or (someone else
  // in it than this tab opened as) the app starts over as them.
  useEffect(() => {
    if (!answer) return;
    const here = hereOf(answer.circles, answer.current);
    const circle = answer.circles.find((c) => c.id === here);
    const me = loadSession();
    if (circle && me && me !== circle.userId) enterCircle(circle, answer.circles);
    else saveCircles(here, answer.circles);
  }, [answer]);

  const remembered = loadCircles();
  const circles = answer?.circles ?? remembered?.circles ?? [];
  const currentId = answer ? hereOf(answer.circles, answer.current) : remembered?.current;
  const current = circles.find((c) => c.id === currentId) ?? null;

  const join = useCallback(
    async (passphrase: string) => {
      const r = await joinWith(passphrase);
      const joined = r.circles.find((c) => c.id === r.joined);
      if (joined) enterCircle(joined, r.circles);
    },
    [joinWith],
  );

  const open = useCallback((circle: MyCircle) => enterCircle(circle, circles), [circles]);

  return { circles, current, join, open };
}
