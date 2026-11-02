/**
 * Events (docs/decisions/0036): a plan with details, for the people it's
 * for. An event lives in the circle it was made in, in its creator's drops;
 * each other circle in its audience holds a pointer to it. Answers and
 * comments stay in the circle they were made in.
 */
import {
  type AudienceCircle,
  type Circle,
  canSee,
  cleanEvent,
  type Drop,
  type Rsvp,
} from '@family-trivia/shared';
import { findCircle, isAdminIn, memberIn, myCircles, scopeOf } from '../../services/circles';
import { currentScope, inCircle } from '../../services/scope';
import {
  load,
  loadAnswers,
  loadPointers,
  ownDrop,
  type Pointer,
  roster,
  save,
  savePointers,
} from './store';

/** Who is asking, and from which circle (requireAuth's Caller, with their id). */
export interface Asker {
  me: string;
  email: string;
  circle: Circle;
}

/** An event as found from this circle: as seen here, as stored, and where it lives. */
interface Found {
  /** As this circle sees it: `by` is its creator's id here. */
  drop: Drop;
  stored: Drop;
  owner: Circle | null;
  pointer?: Pointer;
}

const here = () => currentScope().circleId;

async function sharedIn(p: Pointer): Promise<Found | null> {
  const circle = await findCircle(p.from);
  if (!circle) return null;
  const stored = await inCircle(scopeOf(circle), async () =>
    (await load(p.by)).drops.find((d) => d.id === p.id),
  );
  if (!stored) return null;
  return {
    drop: { ...stored, by: p.here, from: { circleId: circle.id, name: circle.name } },
    stored,
    owner: circle,
    pointer: p,
  };
}

/** A plan by id: one of this circle's own, or an event shared in. */
async function findPlan(id: string): Promise<Found | null> {
  const own = await ownDrop(id);
  if (own) return { drop: own, stored: own, owner: null };
  const pointer = (await loadPointers()).find((p) => p.id === id);
  return pointer ? sharedIn(pointer) : null;
}

/** The events other circles share into this one, as seen here. */
export async function sharedInDrops(): Promise<Drop[]> {
  const found = await Promise.all((await loadPointers()).map(sharedIn));
  return found.flatMap((f) => (f ? [f.drop] : []));
}

/**
 * A plan as `viewer` sees it here: who else it's for elsewhere is its
 * creator's to know.
 */
export function asSeen(d: Drop, viewer: string): Drop {
  if (!d.audience || d.by === viewer) return d;
  return { ...d, audience: d.audience.filter((a) => a.circleId === here()) };
}

/** Whether `me` may see (answer, comment on) a plan by id, here. */
export async function maySee(id: string, me: string): Promise<Found | null> {
  const found = await findPlan(id);
  return found && found.drop.kind !== 'busy' && canSee(found.drop, here(), me) ? found : null;
}

type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };
const no = (status: number, error: string) => ({ ok: false, status, error }) as const;

/**
 * Check an audience against the circles the creator is in (each circle's
 * own sign-in map, 0019) and the people playing there. Returns the
 * creator's id in each of those circles.
 */
async function checkAudience(
  audience: AudienceCircle[] | undefined,
  asker: Asker,
): Promise<Outcome<Map<string, string>>> {
  const ids = new Map<string, string>([[asker.circle.id, asker.me]]);
  for (const a of audience ?? []) {
    const isHere = a.circleId === asker.circle.id;
    const circle = isHere ? asker.circle : await findCircle(a.circleId);
    const me = circle && (isHere ? asker.me : await memberIn(circle, asker.email));
    if (!circle || !me) return no(403, `You're not in circle ${a.circleId}`);
    ids.set(circle.id, me);
    if (a.people) {
      const there = (await inCircle(scopeOf(circle), roster)).map((p) => p.id);
      const unknown = a.people.filter((p) => !there.includes(p));
      if (unknown.length) return no(400, `Not in ${circle.name}: ${unknown.join(', ')}`);
    }
  }
  return { ok: true, value: ids };
}

/**
 * Point each circle in the event's audience at it, and take the pointer
 * out of each of the creator's circles it no longer names. `owner` is the
 * circle it lives in; `ids` the creator's id in each circle.
 */
async function syncPointers(owner: string, event: Drop, asker: Asker, ids: Map<string, string>) {
  const named = new Set((event.audience ?? []).map((a) => a.circleId));
  const theirs = asker.email ? (await myCircles(asker.email)).map((c) => c.id) : [];
  const circles = [...new Set([...theirs, ...named])].filter((c) => c !== owner);
  await Promise.all(
    circles.map(async (id) => {
      const circle = await findCircle(id);
      if (!circle) return;
      await inCircle(scopeOf(circle), async () => {
        const pointers = await loadPointers();
        const rest = pointers.filter((p) => !(p.id === event.id && p.from === owner));
        const creatorHere = ids.get(id);
        const next =
          named.has(id) && creatorHere
            ? [...rest, { from: owner, by: event.by, here: creatorHere, id: event.id }]
            : rest;
        if (JSON.stringify(next) !== JSON.stringify(pointers)) await savePointers(next);
      });
    }),
  );
}

/** Make an event in this circle; its creator is the caller. */
export async function createEvent(raw: unknown, asker: Asker): Promise<Outcome<Drop>> {
  const now = new Date().toISOString();
  const id = `${asker.me}-${Date.now().toString(36)}${crypto.randomUUID().slice(0, 4)}`;
  const cleaned = cleanEvent(raw, { id, by: asker.me, createdAt: now });
  if (!cleaned.ok) return no(400, cleaned.error);
  const ids = await checkAudience(cleaned.value.audience, asker);
  if (!ids.ok) return ids;
  const mine = await load(asker.me);
  await save(asker.me, { drops: [...mine.drops, cleaned.value] });
  await syncPointers(asker.circle.id, cleaned.value, asker, ids.value);
  return { ok: true, value: cleaned.value };
}

/** Its creator, wherever they ask from, or an admin of the circle it was made in. */
async function mayChange(found: Found, asker: Asker): Promise<'creator' | 'admin' | null> {
  if (found.drop.by === asker.me) return 'creator';
  if (!found.pointer && (await isAdminIn(asker.circle, asker.email))) return 'admin';
  return null;
}

/**
 * Change an event: what's sent replaces its fields. Only its creator sets
 * who it's for; an admin's change keeps the audience it had.
 */
export async function updateEvent(raw: unknown, asker: Asker): Promise<Outcome<Drop>> {
  const id = (raw as { id?: unknown } | null)?.id;
  const found = typeof id === 'string' ? await findPlan(id) : null;
  if (found?.stored.kind !== 'plan') return no(404, 'No such event');
  const role = await mayChange(found, asker);
  if (!role) return no(403, 'Only who made it, or an admin, can change it');
  const { stored } = found;
  const sent = role === 'creator' ? raw : { ...(raw as object), audience: stored.audience };
  const cleaned = cleanEvent(sent, {
    id: stored.id,
    by: stored.by,
    createdAt: stored.createdAt,
    updatedAt: new Date().toISOString(),
  });
  if (!cleaned.ok) return no(400, cleaned.error);
  const event = cleaned.value;
  const ids = role === 'creator' ? await checkAudience(event.audience, asker) : null;
  if (ids && !ids.ok) return ids;
  const write = async () => {
    const mine = await load(stored.by);
    await save(stored.by, { drops: mine.drops.map((d) => (d.id === event.id ? event : d)) });
  };
  if (found.owner) await inCircle(scopeOf(found.owner), write);
  else await write();
  const owner = found.owner?.id ?? asker.circle.id;
  if (ids?.ok) {
    // The creator's ids in their circles, from wherever they asked.
    if (found.owner) ids.value.set(owner, stored.by);
    await syncPointers(owner, event, asker, ids.value);
  }
  return { ok: true, value: asSeen({ ...event, by: found.drop.by }, asker.me) };
}

/** A plan taken back by its creator: no circle points at it anymore. */
export async function unshare(drop: Drop, asker: Asker): Promise<void> {
  if (drop.audience)
    await syncPointers(asker.circle.id, { ...drop, audience: [] }, asker, new Map());
}

const count = (answers: Record<string, { answer: Rsvp; guests?: number }>) => {
  const all = Object.values(answers);
  const of = (a: Rsvp) => all.filter((x) => x.answer === a).length;
  return {
    in: of('in'),
    maybe: of('maybe'),
    out: of('out'),
    guests: all.reduce((n, x) => n + (x.answer === 'in' ? (x.guests ?? 0) : 0), 0),
  };
};

/** One event as the caller sees it here. */
export async function eventView(id: string, asker: Asker) {
  const found = await maySee(id, asker.me);
  if (!found) return null;
  const { drop } = found;
  const entry = drop.audience?.find((a) => a.circleId === asker.circle.id);
  const everyone = (await roster()).map((p) => p.id);
  const invited = !drop.audience ? everyone : entry ? (entry.people ?? everyone) : [];
  // The other circles it's in: counts only, named when the caller is in them too.
  const mine = asker.email ? (await myCircles(asker.email)).map((c) => c.id) : [];
  const others = [
    ...new Set([
      ...(found.owner ? [found.owner.id] : []),
      ...(drop.audience ?? []).map((a) => a.circleId),
    ]),
  ].filter((c) => c !== asker.circle.id);
  const elsewhere = (
    await Promise.all(
      others.map(async (cid) => {
        const circle = await findCircle(cid);
        if (!circle) return null;
        const answers = await inCircle(scopeOf(circle), () => loadAnswers(drop.id));
        return {
          name: mine.includes(cid) ? circle.name : 'Another circle',
          ...count(answers),
        };
      }),
    )
  ).filter((x) => x !== null);
  return {
    event: asSeen(drop, asker.me),
    invited,
    rsvps: await loadAnswers(drop.id),
    elsewhere,
    canEdit: (await mayChange(found, asker)) !== null,
  };
}

/** The circles the caller can share an event with, this one first, and who's in each. */
export async function audienceChoices(asker: Asker) {
  const mine = asker.email
    ? (await myCircles(asker.email)).filter((c) => !c.endedAt)
    : [{ id: asker.circle.id, name: asker.circle.name, userId: asker.me }];
  const ordered = [
    ...mine.filter((c) => c.id === asker.circle.id),
    ...mine.filter((c) => c.id !== asker.circle.id),
  ];
  const circles = await Promise.all(
    ordered.map(async (c) => {
      const circle = await findCircle(c.id);
      if (!circle) return null;
      return {
        circleId: c.id,
        name: c.name,
        me: c.userId,
        people: await inCircle(scopeOf(circle), roster),
      };
    }),
  );
  return circles.filter((c) => c !== null);
}
