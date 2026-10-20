/**
 * Joined circles' people (docs/decisions/0018): read from the source
 * circles every time (cached briefly), never copied. Registered with the
 * storage layer as the reader for a joined circle's linked files
 * (services/scope.ts), so every feature that reads people sees everyone
 * without knowing why.
 */

import type { Circle } from '@family-trivia/shared';
import {
  type FactAnswerEntry,
  type FamilyPerson,
  type JoinedPeople,
  joinPeople,
  maybeSame,
  ownAnswers,
  type PersonIn,
  type SamePeople,
  type Sharing,
  type SourcePeople,
  sharesInto,
  withSourceAnswers,
} from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { findCircle, scopeOf } from '../circles';
import { getJson, listObjects, putJson } from '../s3';
import { currentScope, inCircle, type Scope, setLinks } from '../scope';
import { loadFamily, storeFamily } from './roster';

const SIGN_IN_MAP_KEY = 'config/google-auth-map.json';
const TTL_MS = 30_000;
const cache = new Map<string, { at: number; people: Promise<JoinedPeople> }>();

/** Forget a joined circle's people, after a change to it or its sources. */
export const forgetJoined = (circleId?: string) =>
  circleId ? cache.delete(circleId) : cache.clear();

/** What admins said about who is the same person, kept in the joined circle itself. */
const SAME_KEY = 'config/same-people.json';
const noAnswers: SamePeople = { same: [], notSame: [] };

async function answersOf(scope: Scope): Promise<SamePeople> {
  const me = await findCircle(scope.circleId);
  if (!me) return noAnswers;
  return inCircle(scopeOf(me), async () => (await getJson<SamePeople>(SAME_KEY)) ?? noAnswers);
}

async function sourcesOf(scope: Scope): Promise<SourcePeople[]> {
  const sources = await Promise.all(
    (scope.sources ?? []).map(async (id) => {
      const circle = await findCircle(id);
      if (!circle) return null;
      return inCircle(scopeOf(circle), async () => ({
        circleId: id,
        family: await loadFamily(),
        users:
          (
            await getJson<{ users?: Record<string, Record<string, unknown>> }>(
              S3_PATHS.USERS_CONFIG,
            )
          )?.users ?? {},
        signIn: (await getJson<Record<string, string>>(SIGN_IN_MAP_KEY)) ?? {},
      }));
    }),
  );
  return sources.filter((s) => s !== null);
}

async function read(scope: Scope): Promise<JoinedPeople> {
  const [me, sources, answers] = await Promise.all([
    findCircle(scope.circleId),
    sourcesOf(scope),
    answersOf(scope),
  ]);
  return joinPeople(me?.name ?? 'Joined', sources, answers.same);
}

export interface SameSuggestion {
  a: PersonIn & { name: string; circleName: string };
  b: PersonIn & { name: string; circleName: string };
}

/** People in a joined circle who might be one person, for an admin to answer. */
export async function sameSuggestions(scope: Scope): Promise<SameSuggestion[]> {
  const [sources, answers] = await Promise.all([sourcesOf(scope), answersOf(scope)]);
  const joined = await joinedPeople(scope);
  const circleName = async (id: string) => (await findCircle(id))?.name ?? id;
  return Promise.all(
    maybeSame(sources, joined, answers).map(async ({ a, b, name }) => ({
      a: { ...a, name, circleName: await circleName(a.circleId) },
      b: { ...b, name, circleName: await circleName(b.circleId) },
    })),
  );
}

/** An admin's answer: the same person (one here), or not (never asked again). */
export async function answerSame(scope: Scope, a: PersonIn, b: PersonIn, same: boolean) {
  const me = await findCircle(scope.circleId);
  if (!me) return;
  await inCircle(scopeOf(me), async () => {
    const answers = (await getJson<SamePeople>(SAME_KEY)) ?? { same: [], notSame: [] };
    const list = same ? answers.same : answers.notSame;
    list.push({ a, b });
    await putJson(SAME_KEY, answers);
  });
  forgetJoined(scope.circleId);
}

/** The joined people of a joined circle. */
function joinedPeople(scope: Scope = currentScope()): Promise<JoinedPeople> {
  const hit = cache.get(scope.circleId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.people;
  const people = read(scope);
  cache.set(scope.circleId, { at: Date.now(), people });
  people.catch(() => cache.delete(scope.circleId));
  return people;
}

/** Who has played in any source, in joined ids, with whoever has played here. */
async function activation(scope: Scope, own: unknown): Promise<Record<string, boolean>> {
  const p = await joinedPeople(scope);
  const out: Record<string, boolean> = { ...((own as Record<string, boolean> | null) ?? {}) };
  for (const id of scope.sources ?? []) {
    const circle = await findCircle(id);
    if (!circle) continue;
    const played = await inCircle(scopeOf(circle), () =>
      getJson<Record<string, boolean>>(S3_PATHS.MEMBER_ACTIVATION),
    );
    for (const [joined, homes] of Object.entries(p.homes))
      if (homes.some((h) => h.circleId === id && played?.[h.id])) out[joined] = true;
  }
  return out;
}

// ── Past answers (docs/decisions/0018) ──────────────────────────

/** Who shares their past answers here, kept in the joined circle itself. */
const SHARING_KEY = 'config/sharing.json';

async function sharingOf(scope: Scope): Promise<Sharing> {
  const me = await findCircle(scope.circleId);
  if (!me) return {};
  return inCircle(scopeOf(me), async () => (await getJson<Sharing>(SHARING_KEY)) ?? {});
}

/** Where a personal file's person lives, for the sources they share from. */
async function sharedHomes(scope: Scope, personId: string) {
  const [p, sharing] = await Promise.all([joinedPeople(scope), sharingOf(scope)]);
  const out: { circle: Circle; id: string }[] = [];
  for (const home of p.homes[personId] ?? []) {
    const circle = await findCircle(home.circleId);
    if (circle && sharesInto(sharing, personId, circle)) out.push({ circle, id: home.id });
  }
  return out;
}

const fileOf = (folder: string, key: string) => key.slice(folder.length, -'.json'.length);

async function personalRead(key: string, scope: Scope, own: unknown) {
  const folder = 'facts/answers/';
  const homes = await sharedHomes(scope, fileOf(folder, key));
  const sources = await Promise.all(
    homes.map(async ({ circle, id }) => ({
      circleId: circle.id,
      name: circle.name,
      entries: await inCircle(scopeOf(circle), () =>
        getJson<FactAnswerEntry[]>(`${folder}${id}.json`),
      ),
    })),
  );
  return withSourceAnswers(own as FactAnswerEntry[] | null, sources);
}

async function personalList(folder: string, scope: Scope, own: string[]): Promise<string[]> {
  const p = await joinedPeople(scope);
  const keys = new Set(own);
  // Each source's folder, listed once.
  const listed = new Map<string, Promise<Set<string>>>();
  const inSource = (circle: Circle) => {
    let l = listed.get(circle.id);
    if (!l) {
      l = inCircle(scopeOf(circle), () => listObjects(folder)).then((k) => new Set(k));
      listed.set(circle.id, l);
    }
    return l;
  };
  for (const personId of Object.keys(p.homes))
    for (const { circle, id } of await sharedHomes(scope, personId))
      if ((await inSource(circle)).has(`${folder}${id}.json`))
        keys.add(`${folder}${personId}.json`);
  return [...keys];
}

setLinks({
  read: async (key, scope, own) => {
    if (key.startsWith('facts/answers/')) return personalRead(key, scope, own);
    if (key === S3_PATHS.MEMBER_ACTIVATION) return activation(scope, own);
    const p = await joinedPeople(scope);
    if (key === S3_PATHS.FAMILY) return p.family;
    if (key === S3_PATHS.USERS_CONFIG) return { users: p.users };
    if (key === SIGN_IN_MAP_KEY) return p.signIn;
    // The old hierarchy file: none, so it's derived from the joined family.
    return null;
  },
  list: personalList,
  own: (_key, value) => (Array.isArray(value) ? ownAnswers(value) : value),
});

export interface SharedFrom {
  circleId: string;
  name: string;
  kind: Circle['kind'];
  shared: boolean;
}

/** In a joined circle: each circle someone's past answers could come from, and whether they do. */
export async function sharingFor(scope: Scope, personId: string): Promise<SharedFrom[]> {
  const [p, sharing] = await Promise.all([joinedPeople(scope), sharingOf(scope)]);
  const out: SharedFrom[] = [];
  for (const home of p.homes[personId] ?? []) {
    const circle = await findCircle(home.circleId);
    if (!circle) continue;
    const { id, name, kind } = circle;
    out.push({ circleId: id, name, kind, shared: sharesInto(sharing, personId, circle) });
  }
  return out;
}

/** Share someone's past answers from one source here, or keep them out. */
export async function setSharing(scope: Scope, personId: string, from: string, shared: boolean) {
  const me = await findCircle(scope.circleId);
  if (!me) return;
  await inCircle(scopeOf(me), async () => {
    const sharing = (await getJson<Sharing>(SHARING_KEY)) ?? {};
    sharing[personId] = { ...sharing[personId], [from]: shared };
    await putJson(SHARING_KEY, sharing);
  });
}

/**
 * Change one person's own record (their picture, say). In a joined circle
 * the change goes to every source circle they're in, so it shows everywhere.
 */
export async function updatePerson(
  userId: string,
  change: (p: FamilyPerson) => FamilyPerson,
): Promise<boolean> {
  const scope = currentScope();
  if (!scope.sources?.length) {
    const family = await loadFamily();
    const me = family.people[userId];
    if (!me) return false;
    await storeFamily({ ...family, people: { ...family.people, [userId]: change(me) } }, userId);
    return true;
  }
  const homes = (await joinedPeople(scope)).homes[userId] ?? [];
  let found = false;
  for (const home of homes) {
    const circle = await findCircle(home.circleId);
    if (!circle) continue;
    await inCircle(scopeOf(circle), async () => {
      const family = await loadFamily();
      const me = family.people[home.id];
      if (!me) return;
      found = true;
      await storeFamily(
        { ...family, people: { ...family.people, [home.id]: { ...change(me), id: home.id } } },
        home.id,
      );
    });
  }
  forgetJoined(scope.circleId);
  return found;
}
