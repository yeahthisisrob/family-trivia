/**
 * Circles and who belongs to them (docs/decisions/0015).
 *
 * The truth of membership is each circle's own sign-in map
 * (config/google-auth-map.json: email → the person's id in that circle), so a
 * circle's admin is the only one who decides who is in it. A person can be in
 * any number of circles. To find theirs without opening every circle on each
 * request, an account index (accounts/{hash}.json) lists them; sign-in
 * rebuilds it, and every request still checks the circle's own map, so
 * someone removed from a circle loses it at once.
 */
import { createHash } from 'node:crypto';
import type {
  Circle,
  CircleKind,
  CircleRegistry,
  MyCircle,
  SeasonsConfig,
} from '@family-trivia/shared';
import { S3_PATHS } from '../constants';
import { addMember, idFor, nextColor } from './family/members';
import { logger } from './logger';
import { forgetCached, getJson, putJson } from './s3';
import { currentScope, inCircle, type Scope } from './scope';

const REGISTRY_KEY = 'circles.json';
const SIGN_IN_MAP_KEY = 'config/google-auth-map.json';
const USERS_KEY = 'config/users.json';

/** Before circles, a deployment was one family at the bucket root. */
const IMPLICIT_ROOT: Circle = { id: 'home', name: 'Family', kind: 'family', root: true };

type SignInMap = Record<string, string>; // email → userId in that circle

interface AccountIndex {
  email: string;
  memberships: { circleId: string; userId: string }[];
  updatedAt: string;
}

export const scopeOf = (circle: Circle): Scope => ({
  circleId: circle.id,
  root: circle.root === true,
  ...(circle.sources?.length && { sources: circle.sources }),
});

export async function listCircles(): Promise<Circle[]> {
  const registry = await getJson<CircleRegistry>(REGISTRY_KEY);
  return registry?.circles?.length ? registry.circles : [IMPLICIT_ROOT];
}

export async function findCircle(id: string): Promise<Circle | null> {
  const known = (await listCircles()).find((c) => c.id === id);
  if (known) return known;
  // A circle made a moment ago on another server: read the registry fresh once.
  forgetCached(REGISTRY_KEY);
  return (await listCircles()).find((c) => c.id === id) ?? null;
}

/** The kind of circle this request is in. Family for the root circle from before circles. */
export async function currentCircleKind(): Promise<CircleKind> {
  return (await findCircle(currentScope().circleId))?.kind ?? 'family';
}

const normalize = (email: string) => email.trim().toLowerCase();
/** A stable id for a sign-in that doesn't put the email in keys or tokens. */
export const accountIdOf = (email: string) =>
  createHash('sha256').update(normalize(email)).digest('hex').slice(0, 32);
const accountKey = (email: string) => `accounts/${accountIdOf(email)}.json`;

/** Who this email is in one circle, from that circle's own map. */
export function memberIn(circle: Circle, email: string): Promise<string | null> {
  return inCircle(scopeOf(circle), async () => {
    const map = (await getJson<SignInMap>(SIGN_IN_MAP_KEY)) ?? {};
    const wanted = normalize(email);
    const hit = Object.entries(map).find(([e]) => normalize(e) === wanted);
    return hit?.[1] ?? null;
  });
}

const asMine = (circle: Circle, userId: string): MyCircle => ({
  id: circle.id,
  name: circle.name,
  kind: circle.kind,
  userId,
  ...(circle.sources && { sources: circle.sources }),
  ...(circle.endedAt && { endedAt: circle.endedAt }),
});

/**
 * Every circle this email belongs to, read from each circle and written to
 * the account index. Runs at sign-in, the one time it's worth opening them all.
 */
export async function rebuildMemberships(email: string): Promise<MyCircle[]> {
  if (!email) return [];
  const circles = await listCircles();
  const found = await Promise.all(
    circles.map(async (c) => {
      const userId = await memberIn(c, email);
      return userId ? asMine(c, userId) : null;
    }),
  );
  const mine = found.filter((c): c is MyCircle => c !== null);
  const index: AccountIndex = {
    email: normalize(email),
    memberships: mine.map((c) => ({ circleId: c.id, userId: c.userId })),
    updatedAt: new Date().toISOString(),
  };
  await putJson(accountKey(email), index);
  return mine;
}

/** This email's circles from the account index (rebuilt if it's missing). */
/** Who signs in to a circle: account id → their person there. Emails stay on the server. */
export async function accountsIn(circle: Circle): Promise<Record<string, string>> {
  const map = await inCircle(
    scopeOf(circle),
    async () => (await getJson<SignInMap>(SIGN_IN_MAP_KEY)) ?? {},
  );
  return Object.fromEntries(
    Object.entries(map).map(([email, userId]) => [accountIdOf(email), userId]),
  );
}

export async function myCircles(email: string): Promise<MyCircle[]> {
  const index = await getJson<AccountIndex>(accountKey(email));
  if (!index) return rebuildMemberships(email);
  const circles = await listCircles();
  return index.memberships.flatMap((m) => {
    const circle = circles.find((c) => c.id === m.circleId);
    return circle ? [asMine(circle, m.userId)] : [];
  });
}

export type Resolved =
  | { ok: true; circle: Circle; userId: string }
  | { ok: false; status: 403 | 404; error: string };

/**
 * The circle a request is for and who the caller is in it. With no circle
 * named, someone in one circle gets that one (old clients keep working);
 * someone in several gets the first they joined.
 */
export async function resolveCircle(email: string, requested?: string): Promise<Resolved> {
  let mine = await myCircles(email);
  // Added to a circle since they last signed in: the index catches up now.
  if (requested && !mine.some((c) => c.id === requested)) mine = await rebuildMemberships(email);
  const pick = requested ? mine.find((c) => c.id === requested) : mine[0];
  if (!pick) {
    return requested
      ? { ok: false, status: 403, error: 'Not a member of this circle' }
      : { ok: false, status: 403, error: 'Not a member of any circle' };
  }
  const circle = await findCircle(pick.id);
  if (!circle) return { ok: false, status: 404, error: 'Circle not found' };
  // The index can lag; the circle's own map is the truth.
  const userId = await memberIn(circle, email);
  if (!userId) return { ok: false, status: 403, error: 'Not a member of this circle' };
  return { ok: true, circle, userId };
}

interface UsersConfig {
  users: Record<string, { passphrase?: string }>;
}

export type LinkResult =
  | { ok: true; circle: Circle; userId: string }
  | { ok: false; status: 401 | 409; error: string; errorType: string };

/**
 * Link this email to the person a passphrase names, in whichever circle it
 * belongs to. A passphrase is unique across circles (admins are told when
 * one isn't); if two circles share one, nobody is linked until it's fixed.
 */
export async function linkByPassphrase(email: string, passphrase: string): Promise<LinkResult> {
  const wanted = passphrase.trim().toLowerCase();
  const circles = await listCircles();
  const matches = (
    await Promise.all(
      circles.map((circle) =>
        inCircle(scopeOf(circle), async () => {
          const users = (await getJson<UsersConfig>(USERS_KEY))?.users ?? {};
          const hit = Object.entries(users).find(
            ([, u]) => u.passphrase?.trim().toLowerCase() === wanted,
          );
          return hit ? { circle, userId: hit[0] } : null;
        }),
      ),
    )
  ).filter((m): m is { circle: Circle; userId: string } => m !== null);

  if (matches.length === 0)
    return { ok: false, status: 401, error: 'Invalid passphrase', errorType: 'INVALID_PASSPHRASE' };
  if (matches.length > 1) {
    logger.warn('Passphrase is shared by more than one circle', {
      circles: matches.map((m) => m.circle.id),
    });
    return {
      ok: false,
      status: 409,
      error: 'This passphrase is used in more than one circle. Ask the admin for a new one.',
      errorType: 'PASSPHRASE_AMBIGUOUS',
    };
  }

  const [{ circle, userId }] = matches as [{ circle: Circle; userId: string }];
  return linkMember(circle, userId, email);
}

/**
 * Link a Google account to one person in a circle (passphrases, invites and
 * approved joins all end here). A person is linked to one account only.
 */
export function linkMember(circle: Circle, userId: string, email: string): Promise<LinkResult> {
  return inCircle(scopeOf(circle), async () => {
    const map = (await getJson<SignInMap>(SIGN_IN_MAP_KEY)) ?? {};
    const linkedTo = Object.entries(map).find(([, uid]) => uid === userId)?.[0];
    if (linkedTo && normalize(linkedTo) !== normalize(email)) {
      return {
        ok: false as const,
        status: 409 as const,
        error: 'This person is already linked to a different Google account. Contact the admin.',
        errorType: 'USER_ALREADY_LINKED',
      };
    }
    map[email] = userId;
    await putJson(SIGN_IN_MAP_KEY, map);
    return { ok: true as const, circle, userId };
  });
}

// ── Making circles ──────────────────────────────────────────────

/**
 * The deployment's owner: an admin of its founding circle (the first). They
 * can start new circles; each circle's own admins run that circle.
 */
export async function isOwner(email: string): Promise<boolean> {
  const [founding] = await listCircles();
  if (!founding) return false;
  const userId = await memberIn(founding, email);
  if (!userId) return false;
  return inCircle(scopeOf(founding), async () => {
    const users = (await getJson<UsersConfig>(USERS_KEY))?.users ?? {};
    return (users[userId] as { isAdmin?: boolean } | undefined)?.isAdmin === true;
  });
}

const CIRCLE_ID = /^[a-z0-9-]{1,40}$/;

/**
 * Start a circle with its maker as its first admin, already signed in to it:
 * an entry in circles.json (the founding circle kept first), and in the new
 * circle its people (just them, through the one way people are added) and
 * its sign-in map.
 */
/**
 * A new circle is playable the moment it exists: Season 1 is on, open-ended,
 * with general trivia and the circle's own category (Our Crew, Our Family),
 * which asks general questions until the circle has shared enough.
 */
function firstSeason(kind: CircleKind): SeasonsConfig {
  return {
    currentSeasonNumber: 1,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: null,
        message: null,
        trivia: 'mixed',
        // Friends play a handful a week; a family, a little every day (0016).
        ...(kind === 'family' ? {} : { pace: 'weekly' as const }),
      },
    ],
  };
}

/** Everything a circle starts with: its maker as admin, their sign-in, its look and Season 1. */
async function seedCircle(
  circle: Circle,
  input: { themeId?: string },
  maker: { email: string; name: string },
): Promise<MyCircle[]> {
  await inCircle(scopeOf(circle), async () => {
    const userId = idFor(maker.name, () => false);
    const added = await addMember({
      id: userId,
      name: maker.name,
      color: nextColor({}),
      isAdmin: true,
    });
    if (!added.ok) throw new Error(added.error);
    await putJson(SIGN_IN_MAP_KEY, { [maker.email]: userId });
    if (input.themeId) await putJson(S3_PATHS.APPEARANCE, { themeId: input.themeId });
    await putJson(S3_PATHS.SEASONS_CONFIG, firstSeason(circle.kind));
  });
  return rebuildMemberships(maker.email);
}

export async function createCircle(
  input: { name: string; kind: CircleKind; themeId?: string },
  maker: { email: string; name: string },
): Promise<Circle> {
  const circles = await listCircles();
  const base = idFor(input.name, () => false);
  const id = idFor(base, (c) => circles.some((x) => x.id === c) || !CIRCLE_ID.test(c));
  const circle: Circle = {
    id,
    name: input.name.trim(),
    kind: input.kind,
    createdAt: new Date().toISOString(),
  };
  const registry: CircleRegistry = { version: 1, circles: [...circles, circle] };
  await putJson(REGISTRY_KEY, registry);
  await seedCircle(circle, input, maker);
  logger.info('Circle created', { circleId: id, kind: input.kind });
  return circle;
}

/**
 * A deployment nobody has started: no circles written and nobody in the
 * first circle. The first sign-in then starts it (docs/decisions/0029).
 */
export async function isUnstarted(): Promise<boolean> {
  if (await getJson<CircleRegistry>(REGISTRY_KEY)) return false;
  const users = await inCircle(scopeOf(IMPLICIT_ROOT), () =>
    getJson<{ users?: Record<string, unknown> }>(USERS_KEY),
  );
  return !users?.users || Object.keys(users.users).length === 0;
}

/** Start the deployment's first circle, with whoever signed in as its owner. */
export async function startFirstCircle(
  input: { name: string; kind: CircleKind; themeId?: string },
  maker: { email: string; name: string },
): Promise<Circle> {
  const circle: Circle = {
    ...IMPLICIT_ROOT,
    name: input.name.trim(),
    kind: input.kind,
    createdAt: new Date().toISOString(),
  };
  await putJson(REGISTRY_KEY, { version: 1, circles: [circle] } satisfies CircleRegistry);
  await seedCircle(circle, input, maker);
  logger.info('First circle started', { kind: input.kind });
  return circle;
}

// ── Joining and splitting (docs/decisions/0018) ─────────────────

/** Whether this email is an admin in a circle, by that circle's own people. */
function isAdminIn(circle: Circle, email: string): Promise<boolean> {
  return inCircle(scopeOf(circle), async () => {
    const userId = await memberIn(circle, email);
    if (!userId) return false;
    const users = (await getJson<UsersConfig>(USERS_KEY))?.users ?? {};
    return (users[userId] as { isAdmin?: boolean } | undefined)?.isAdmin === true;
  });
}

export type JoinResult =
  | { ok: true; circle: Circle; again: boolean }
  | { ok: false; status: 400 | 403 | 404 | 409; error: string };

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

const kindOf = (kinds: CircleKind[]): CircleKind =>
  kinds.every((k) => k === kinds[0]) ? (kinds[0] as CircleKind) : 'mixed';

async function writeRegistry(circles: Circle[]): Promise<void> {
  await putJson(REGISTRY_KEY, { version: 1, circles } satisfies CircleRegistry);
  forgetCached(REGISTRY_KEY);
}

/** Everyone who signs in to a circle (a joined one: everyone in its sources) sees it in their list. */
async function refreshMembersOf(circle: Circle): Promise<void> {
  const map = await inCircle(
    scopeOf(circle),
    async () => (await getJson<SignInMap>(SIGN_IN_MAP_KEY)) ?? {},
  );
  await Promise.all(Object.keys(map).map((email) => rebuildMemberships(email)));
}

/** The joined circle's season: paused when it's split, picked up when joined again. */
async function setSeasonOpen(
  circle: Circle,
  open: boolean,
  seasonNumber?: number,
): Promise<number | undefined> {
  return inCircle(scopeOf(circle), async () => {
    const config = await getJson<SeasonsConfig>(S3_PATHS.SEASONS_CONFIG);
    if (!config) return undefined;
    const today = new Date().toISOString().slice(0, 10);
    const number = open ? seasonNumber : (config.currentSeasonNumber ?? undefined);
    const season = config.seasons.find((x) => x.seasonNumber === number);
    if (!season) return undefined;
    season.status = open ? 'active' : 'concluded';
    season.endDate = open ? null : today;
    config.currentSeasonNumber = open ? season.seasonNumber : null;
    await putJson(S3_PATHS.SEASONS_CONFIG, config);
    return season.seasonNumber;
  });
}

/**
 * Join two or more circles into one (docs/decisions/0018). Nothing moves:
 * the joined circle reads its sources' people, and keeps its own seasons and
 * answers. The same circles joined again pick up the circle they had.
 */
export async function joinCircles(
  input: { name: string; sources: string[]; themeId?: string },
  email: string,
): Promise<JoinResult> {
  const ids = [...new Set(input.sources)];
  if (ids.length < 2) return { ok: false, status: 400, error: 'Pick at least two circles' };
  const circles = await listCircles();
  const sources = ids.map((id) => circles.find((c) => c.id === id));
  if (sources.some((c) => !c)) return { ok: false, status: 404, error: 'Circle not found' };
  const found = sources as Circle[];
  if (found.some((c) => c.sources))
    return { ok: false, status: 400, error: 'Join the circles themselves, not a joined one' };
  for (const c of found)
    if (!(await isAdminIn(c, email)))
      return { ok: false, status: 403, error: `You need to be an admin in ${c.name}` };

  const before = circles.find((c) => c.sources && sameSet(c.sources, ids));
  if (before && !before.endedAt)
    return { ok: false, status: 409, error: `These are joined already, as ${before.name}` };

  if (before) {
    const { endedAt: _ended, pausedSeason, ...again } = before;
    await writeRegistry(circles.map((c) => (c.id === before.id ? again : c)));
    if (pausedSeason) await setSeasonOpen(again, true, pausedSeason);
    await refreshMembersOf(again);
    logger.info('Circles joined again', { circleId: again.id });
    return { ok: true, circle: again, again: true };
  }

  const name = input.name.trim().slice(0, 60) || found.map((c) => c.name).join(' + ');
  const id = idFor(
    idFor(name, () => false),
    (c) => circles.some((x) => x.id === c) || !CIRCLE_ID.test(c),
  );
  const circle: Circle = {
    id,
    name,
    kind: kindOf(found.map((c) => c.kind)),
    sources: ids,
    createdAt: new Date().toISOString(),
  };
  await writeRegistry([...circles, circle]);
  await inCircle(scopeOf(circle), async () => {
    if (input.themeId) await putJson(S3_PATHS.APPEARANCE, { themeId: input.themeId });
    await putJson(S3_PATHS.SEASONS_CONFIG, firstSeason(circle.kind));
  });
  await refreshMembersOf(circle);
  logger.info('Circles joined', { circleId: id, sources: ids.length });
  return { ok: true, circle, again: false };
}

/**
 * Split a joined circle: it ends, and nothing is deleted. Its season pauses;
 * its answers stay. The sources carry on as they were.
 */
export async function splitCircle(id: string, email: string): Promise<JoinResult> {
  const circles = await listCircles();
  const circle = circles.find((c) => c.id === id);
  if (!circle) return { ok: false, status: 404, error: 'Circle not found' };
  if (!circle.sources)
    return { ok: false, status: 400, error: 'Only a joined circle can be split' };
  if (circle.endedAt) return { ok: false, status: 409, error: 'Split already' };
  if (!(await isAdminIn(circle, email)))
    return { ok: false, status: 403, error: `You need to be an admin in ${circle.name}` };
  const pausedSeason = await setSeasonOpen(circle, false);
  const ended = {
    ...circle,
    endedAt: new Date().toISOString(),
    ...(pausedSeason && { pausedSeason }),
  };
  await writeRegistry(circles.map((c) => (c.id === id ? ended : c)));
  logger.info('Circle split', { circleId: id });
  return { ok: true, circle: ended, again: false };
}
