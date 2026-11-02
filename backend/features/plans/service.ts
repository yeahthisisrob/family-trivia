/**
 * Plans (docs/decisions/0026, 0036): the weeks ahead, dropping in, answers,
 * and what people remember after. Where it's all kept: store.ts.
 */
import {
  type AfterPlan,
  addDays,
  canSee,
  cleanDrop,
  type Drop,
  getTodayET,
  isEvent,
  lastDayOf,
  type PlanMemory,
  type PlansView,
  plansView,
  type Rsvp,
} from '@family-trivia/shared';
import { getJson, listObjects, putJson } from '../../services/s3';
import { currentScope } from '../../services/scope';
import { latestStart, readDrops } from './ai';
import { asSeen, maySee, sharedInDrops } from './events';
import {
  type Answers,
  allDrops,
  eventsOn,
  load,
  loadAnswers,
  people,
  save,
  saveAnswers,
} from './store';

/** The people who said they're in, after whoever made it. */
const inFor = (d: Drop, answers: Answers) => [
  d.by,
  ...Object.keys(answers).filter((u) => answers[u]?.answer === 'in' && u !== d.by),
];

/** The weeks ahead, as `viewer` sees them: only what they're invited to (0036). */
export async function viewPlans(viewer: string, weeks = 8): Promise<PlansView> {
  const from = getTodayET();
  const to = addDays(from, weeks * 7 - 1);
  const here = currentScope().circleId;
  const ids = await people();
  // With events off, the weeks ahead are drop-ins only, and nothing is shared in.
  const events = await eventsOn();
  const drops = [...(await allDrops(ids)), ...(events ? await sharedInDrops() : [])]
    .filter((d) => (events || !isEvent(d)) && canSee(d, here, viewer))
    .map((d) => asSeen(d, viewer));
  const joinable = drops.filter((d) => d.kind !== 'busy');
  const rsvps = Object.fromEntries(
    await Promise.all(joinable.map(async (d) => [d.id, await loadAnswers(d.id)] as const)),
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

/** Take back one of your own drops; returns it, or null when it isn't yours. */
export async function removeDrop(me: string, id: string): Promise<Drop | null> {
  const mine = await load(me);
  const drop = mine.drops.find((d) => d.id === id);
  if (!drop) return null;
  await save(me, { drops: mine.drops.filter((d) => d.id !== id) });
  return drop;
}

/** What someone says to a plan: the answer, a word, and how many they bring. */
export interface Answer {
  answer: Rsvp;
  note?: string;
  guests?: number;
}

/**
 * Going, maybe or can't, for a plan, free day or event the caller can see;
 * null takes it back. Answers stay in the circle they were given in (0036).
 */
export async function answerPlan(
  me: string,
  id: string,
  answer: Answer | null,
): Promise<'saved' | 'missing' | 'cancelled'> {
  const found = await maySee(id, me);
  if (!found || !(await people()).includes(me)) return 'missing';
  if (found.drop.cancelled && answer) return 'cancelled';
  const { [me]: _old, ...rest } = await loadAnswers(id);
  const note = answer?.note?.trim().slice(0, 200);
  await saveAnswers(
    id,
    answer
      ? {
          ...rest,
          [me]: {
            answer: answer.answer,
            ...(note ? { note } : {}),
            ...(answer.guests ? { guests: answer.guests } : {}),
            at: new Date().toISOString(),
          },
        }
      : rest,
  );
  return 'saved';
}

// ── After the day: memories (docs/decisions/0026) ─────────────────────────

const MEMORIES = (dropId: string) => `plans/memories/${dropId}.json`;

interface Memories {
  memories: PlanMemory[];
  /** People who said "skip": the plan stops asking them. */
  skipped: string[];
  /**
   * The plan itself, kept with what people remember of it: plans are let go
   * after a few months (store.ts), memories never are.
   */
  plan?: { title: string; start: string; end?: string; who: string[] };
}

const loadMemories = async (id: string): Promise<Memories> =>
  (await getJson<Memories>(MEMORIES(id))) ?? { memories: [], skipped: [] };

/** Plans from the last two weeks that `me` was part of and hasn't skipped. */
export async function afterPlans(me: string): Promise<AfterPlan[]> {
  const today = getTodayET();
  const drops = await allDrops();
  const out: AfterPlan[] = [];
  for (const d of drops) {
    if (d.kind !== 'plan' || d.cancelled || !lastDayOf(d, today)) continue;
    const who = inFor(d, await loadAnswers(d.id));
    if (!who.includes(me)) continue;
    const m = await loadMemories(d.id);
    if (m.skipped.includes(me)) continue;
    out.push({ drop: d, who, memories: m.memories });
  }
  return out.sort((a, b) =>
    (lastDayOf(b.drop, today) ?? '').localeCompare(lastDayOf(a.drop, today) ?? ''),
  );
}

/** Add a memory to a plan you were part of, or skip it. */
export async function rememberPlan(
  me: string,
  id: string,
  input: { text: string } | 'skip',
): Promise<boolean> {
  const mine = (await afterPlans(me)).find((p) => p.drop.id === id);
  if (!mine) return false;
  const m = await loadMemories(id);
  const { title, start, end } = mine.drop;
  m.plan = { title, start, ...(end && { end }), who: mine.who };
  if (input === 'skip') m.skipped = [...new Set([...m.skipped, me])];
  else {
    const text = input.text.trim().slice(0, 1000);
    if (!text) return false;
    m.memories.push({ by: me, text, at: new Date().toISOString() });
  }
  await putJson(MEMORIES(id), m);
  return true;
}

// ── Life events (docs/decisions/0018) ────────────────────────────────────

/**
 * The plans `me` was in that are over: the ones still kept, and every plan
 * someone remembered, however old.
 */
export async function pastPlans(
  me: string,
): Promise<{ title: string; date: string; with: string[]; memory?: PlanMemory }[]> {
  const today = getTodayET();
  const drops = await allDrops();
  const out = new Map<
    string,
    { title: string; date: string; with: string[]; memory?: PlanMemory }
  >();
  for (const d of drops) {
    if (d.kind !== 'plan' || d.cancelled || d.weekly || (d.end ?? d.start) >= today) continue;
    const who = inFor(d, await loadAnswers(d.id));
    if (who.includes(me))
      out.set(d.id, { title: d.title, date: d.start, with: who.filter((w) => w !== me) });
  }
  for (const key of await listObjects('plans/memories/')) {
    const id = key.slice('plans/memories/'.length, -'.json'.length);
    const m = await loadMemories(id);
    const known = out.get(id);
    const plan = m.plan;
    if (!known && !plan?.who.includes(me)) continue;
    const memory = m.memories.find((x) => x.by === me) ?? m.memories[0];
    out.set(id, {
      ...(known ?? {
        title: plan?.title ?? '',
        date: plan?.start ?? '',
        with: (plan?.who ?? []).filter((w) => w !== me),
      }),
      ...(memory && { memory }),
    });
  }
  return [...out.values()].filter((p) => p.title && p.date);
}
