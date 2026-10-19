/**
 * Plans (docs/decisions/0026). Each person's drops live at
 * plans/people/{userId}.json; who's in for a plan at plans/rsvp/{dropId}.json.
 */
import {
  addDays,
  cleanDrop,
  type Drop,
  getTodayET,
  isPlaying,
  type PlansView,
  plansView,
  type Rsvp,
} from '@family-trivia/shared';
import { loadJoined } from '../../services/family/joined';
import { getJson, putJson } from '../../services/s3';
import { latestStart, readDrops } from './ai';

const PERSON = (id: string) => `plans/people/${id}.json`;
const RSVP = (dropId: string) => `plans/rsvp/${dropId}.json`;
/** Past drops are kept this long, then let go. */
const KEEP_DAYS = 120;

interface Mine {
  drops: Drop[];
}

const load = async (id: string): Promise<Mine> =>
  (await getJson<Mine>(PERSON(id))) ?? { drops: [] };

const lastDay = (d: Drop) =>
  d.weekly ? (d.weekly.until ?? addDays(d.start, 91)) : (d.end ?? d.start);

async function save(id: string, mine: Mine) {
  const cutoff = addDays(getTodayET(), -KEEP_DAYS);
  await putJson(PERSON(id), { drops: mine.drops.filter((d) => lastDay(d) >= cutoff) });
}

async function people() {
  const { visible } = await loadJoined();
  return Object.values(visible.people)
    .filter(isPlaying)
    .map((p) => p.id);
}

/** The weeks ahead, as `viewer` sees them. */
export async function viewPlans(viewer: string, weeks = 8): Promise<PlansView> {
  const from = getTodayET();
  const to = addDays(from, weeks * 7 - 1);
  const ids = await people();
  const drops = (await Promise.all(ids.map(async (id) => (await load(id)).drops))).flat();
  const joinable = drops.filter((d) => d.kind !== 'busy');
  const rsvps = Object.fromEntries(
    await Promise.all(
      joinable.map(
        async (d) => [d.id, (await getJson<Record<string, Rsvp>>(RSVP(d.id))) ?? {}] as const,
      ),
    ),
  );
  return plansView(viewer, ids, drops, rsvps, from, to);
}

/** Drop in what you're doing, in your own words. Returns what was added (maybe nothing). */
export async function dropIn(me: string, text: string): Promise<Drop[]> {
  const today = getTodayET();
  const proposed = await readDrops(text, today);
  const now = new Date().toISOString();
  const added = proposed
    .map((raw, i) =>
      cleanDrop(raw, {
        id: `${me}-${Date.now().toString(36)}-${i}`,
        by: me,
        createdAt: now,
        said: text.slice(0, 200),
      }),
    )
    .filter((d): d is Drop => !!d && d.start >= today && d.start <= latestStart(today));
  if (added.length) {
    const mine = await load(me);
    await save(me, { drops: [...mine.drops, ...added] });
  }
  return added;
}

/** Take back one of your own drops. */
export async function removeDrop(me: string, id: string): Promise<boolean> {
  const mine = await load(me);
  const next = mine.drops.filter((d) => d.id !== id);
  if (next.length === mine.drops.length) return false;
  await save(me, { drops: next });
  return true;
}

/** I'm in, or I can't, for someone's plan or free day. */
export async function answerPlan(me: string, id: string, answer: Rsvp | null): Promise<boolean> {
  const ids = await people();
  // A drop's id starts with its owner's ("alice-2-…" could be alice's or alice-2's): check each.
  const owners = ids.filter((p) => id.startsWith(`${p}-`));
  const found = await Promise.all(owners.map(async (o) => (await load(o)).drops));
  const drop = found.flat().find((d) => d.id === id && d.kind !== 'busy');
  if (!drop || !ids.includes(me)) return false;
  const current = (await getJson<Record<string, Rsvp>>(RSVP(id))) ?? {};
  const { [me]: _old, ...rest } = current;
  await putJson(RSVP(id), answer ? { ...rest, [me]: answer } : rest);
  return true;
}
