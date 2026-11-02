/**
 * Where plans are kept (docs/decisions/0026, 0036), in the circle a request
 * is in: each person's drops at plans/people/{userId}.json, everyone's
 * answers to a plan at plans/rsvp/{dropId}.json, and the events other
 * circles share in at plans/shared-in.json (pointers, never copies).
 */
import {
  addDays,
  type Drop,
  finalDayOf,
  getTodayET,
  isPlaying,
  type RsvpEntry,
} from '@family-trivia/shared';
import { loadJoined } from '../../services/family/joined';
import { getJson, putJson } from '../../services/s3';
import { getSetting } from '../../services/settings';

const PERSON = (id: string) => `plans/people/${id}.json`;
const RSVP = (dropId: string) => `plans/rsvp/${dropId}.json`;
const SHARED_IN = 'plans/shared-in.json';
/** Past drops are kept this long, then let go. */
const KEEP_DAYS = 120;

interface Mine {
  drops: Drop[];
}

export type Answers = Record<string, RsvpEntry>;

/**
 * An event from another circle, shared into this one: where it lives, who
 * made it there, and who that is here.
 */
export interface Pointer {
  from: string;
  by: string;
  here: string;
  id: string;
}

export const load = async (id: string): Promise<Mine> =>
  (await getJson<Mine>(PERSON(id))) ?? { drops: [] };

/** Save someone's drops, letting go of those long over; a rule that keeps going stays. */
export async function save(id: string, mine: Mine) {
  const cutoff = addDays(getTodayET(), -KEEP_DAYS);
  await putJson(PERSON(id), {
    drops: mine.drops.filter((d) => (finalDayOf(d) ?? cutoff) >= cutoff),
  });
}

export const loadAnswers = async (dropId: string): Promise<Answers> =>
  (await getJson<Answers>(RSVP(dropId))) ?? {};

export const saveAnswers = (dropId: string, answers: Answers) => putJson(RSVP(dropId), answers);

export const loadPointers = async (): Promise<Pointer[]> =>
  (await getJson<{ events: Pointer[] }>(SHARED_IN))?.events ?? [];

export const savePointers = (events: Pointer[]) => putJson(SHARED_IN, { events });

/** Whether this circle has events on (Settings › Features › Events, docs/decisions/0036). */
export const eventsOn = async () => (await getSetting('features.events')) !== false;

/** Everyone playing in this circle. */
export async function people(): Promise<string[]> {
  const { visible } = await loadJoined();
  return Object.values(visible.people)
    .filter(isPlaying)
    .map((p) => p.id);
}

/** Everyone playing in this circle, with their names. */
export async function roster(): Promise<{ id: string; name: string }[]> {
  const { visible } = await loadJoined();
  return Object.values(visible.people)
    .filter(isPlaying)
    .map((p) => ({ id: p.id, name: p.name }));
}

/** This circle's own drops, everyone's. */
export async function allDrops(ids?: string[]): Promise<Drop[]> {
  const who = ids ?? (await people());
  return (await Promise.all(who.map(async (id) => (await load(id)).drops))).flat();
}

/** One of this circle's own drops, by id (an id starts with its owner's). */
export async function ownDrop(id: string): Promise<Drop | null> {
  const ids = await people();
  // "alice-2-…" could be alice's or alice-2's: check each.
  const owners = ids.filter((p) => id.startsWith(`${p}-`));
  return (await allDrops(owners)).find((d) => d.id === id) ?? null;
}
