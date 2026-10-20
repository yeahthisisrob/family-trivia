/**
 * Circles (docs/decisions/0015): the groups people play in. One sign-in can
 * belong to several; each has its own people, seasons and content.
 */

export const CIRCLE_KINDS = ['family', 'friends', 'mixed'] as const;
export type CircleKind = (typeof CIRCLE_KINDS)[number];

export interface Circle {
  id: string;
  name: string;
  kind: CircleKind;
  /**
   * The deployment's first circle, stored at the bucket root from before
   * circles existed. Imported later under circles/{id}/ like any other.
   */
  root?: boolean;
  createdAt?: string;
  /**
   * A joined circle (docs/decisions/0018): the circles it joins. Their people
   * are read through the link, never copied.
   */
  sources?: string[];
  /** A joined circle that was split: kept, readable, and joined again by joining the same circles. */
  endedAt?: string;
  /** The season a split paused, opened again when the circles are joined again. */
  pausedSeason?: number;
}

/** circles.json: every circle in this deployment. */
export interface CircleRegistry {
  version: 1;
  circles: Circle[];
}

/** A circle as one signed-in person sees it: who they are in it. */
export interface MyCircle {
  id: string;
  name: string;
  kind: CircleKind;
  userId: string;
  /** For a joined circle: the circles it joins. */
  sources?: string[];
  /** Set when a joined circle has been split. */
  endedAt?: string;
}

/** The request header that names which circle a request is for. */
export const CIRCLE_HEADER = 'X-Circle';
