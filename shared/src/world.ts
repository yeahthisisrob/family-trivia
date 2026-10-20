/**
 * Your world (docs/decisions/0018): one person's view across their own
 * circles, built when they open it and never stored. Only what they can
 * already see in each circle.
 */
import type { CircleKind } from './circle';
import type { KnowledgeKind } from './knowledge';

export interface WorldNode {
  /** `${circleId}:${personId}` */
  id: string;
  circleId: string;
  personId: string;
  name: string;
  /** The viewer, in this circle. */
  me?: boolean;
  /** Also in another of the viewer's circles (the same sign-in). */
  bridge?: boolean;
}

export interface WorldLink {
  a: string;
  b: string;
  /** A tie inside a circle, or the same person in two circles. */
  kind: 'tie' | 'same';
}

/** Something that comes up in more than one of your circles. */
export interface WorldThread {
  name: string;
  kind: KnowledgeKind;
  people: string[];
}

/** Two people from different circles who share something. */
export interface WorldMeet {
  a: string;
  b: string;
  because: string;
}

/**
 * A moment in someone's life as one of their circles knows it: when they met
 * someone, a wedding, a plan they were in (docs/decisions/0018). Each
 * feature adds its own (backend services/lifeEvents.ts).
 */
export interface LifeEvent {
  /** YYYY, YYYY-MM or YYYY-MM-DD: as much as the circle knows. */
  date: string;
  kind: 'born' | 'met' | 'partner' | 'parent' | 'remembered' | 'joined' | 'plan';
  /** In the viewer's words: "You met Bob", "You joined The Crew". */
  title: string;
  /** A line more: where, how, what someone remembered. */
  detail?: string;
  circleId: string;
}

export interface WorldView {
  circles: { id: string; name: string; kind: CircleKind }[];
  /** False with fewer than two circles: there's nothing to see across. */
  enough: boolean;
  nodes: WorldNode[];
  links: WorldLink[];
  threads: WorldThread[];
  meet: WorldMeet[];
  /** The viewer's life as their circles saw it, oldest first. */
  timeline: LifeEvent[];
}
