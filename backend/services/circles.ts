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
import type { Circle, CircleRegistry, MyCircle } from '@family-trivia/shared';
import { logger } from './logger';
import { getJson, putJson } from './s3';
import { inCircle, type Scope } from './scope';

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
});

export async function listCircles(): Promise<Circle[]> {
  const registry = await getJson<CircleRegistry>(REGISTRY_KEY);
  return registry?.circles?.length ? registry.circles : [IMPLICIT_ROOT];
}

async function findCircle(id: string): Promise<Circle | null> {
  return (await listCircles()).find((c) => c.id === id) ?? null;
}

const normalize = (email: string) => email.trim().toLowerCase();
/** A stable id for a sign-in that doesn't put the email in keys or tokens. */
export const accountIdOf = (email: string) =>
  createHash('sha256').update(normalize(email)).digest('hex').slice(0, 32);
const accountKey = (email: string) => `accounts/${accountIdOf(email)}.json`;

/** Who this email is in one circle, from that circle's own map. */
function memberIn(circle: Circle, email: string): Promise<string | null> {
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
