/**
 * Signing in, and the circles a person belongs to (docs/decisions/0015).
 * One Google sign-in, any number of circles; a passphrase joins one more.
 */

import { CIRCLE_KINDS, type Circle } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, OWNER_EMAIL, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { verifyGoogleToken } from '../../services/auth';
import {
  myCircles as circlesOf,
  createCircle,
  findCircle,
  isAdminIn,
  isOwner,
  isUnstarted,
  joinCircles,
  linkByPassphrase,
  listCircles,
  rebuildMemberships,
  scopeOf,
  splitCircle,
  startFirstCircle,
} from '../../services/circles';
import { answerSame, sameSuggestions } from '../../services/family/joinedCircles';
import { logger } from '../../services/logger';
import { sessionFor } from '../../services/session';

type Body = Record<string, unknown>;

function parse(event: APIGatewayProxyEvent): Body | null {
  try {
    const body: unknown = JSON.parse(event.body || '{}');
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Body) : null;
  } catch {
    return null;
  }
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/**
 * POST /auth/google {googleIdToken, passphrase?, circleId?}
 * Signs in with Google. A passphrase links them to that person in its
 * circle, whether it's their first circle or one more.
 */
export async function signIn(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parse(event);
  if (!body) return errorResponse('Body must be JSON', 400);
  const googleIdToken = text(body.googleIdToken);
  if (!googleIdToken) return errorResponse('Missing googleIdToken', 400);

  const google = await verifyGoogleToken(googleIdToken);
  if (!google) return errorResponse('Invalid or expired Google token', 401);

  const passphrase = text(body.passphrase);
  let joined: string | undefined;
  if (passphrase) {
    const link = await linkByPassphrase(google.email, passphrase);
    if (!link.ok) return errorResponse(link.error, link.status, undefined, link.errorType);
    joined = link.circle.id;
  }

  const session = await sessionFor(google, {
    open: joined ?? text(body.circleId),
    isNewLink: joined !== undefined,
  });
  if (!session) return errorResponse('Account not linked', 401, undefined, 'NOT_LINKED');
  logger.info('Signed in', { circles: session.circles.length, joined: joined ?? null });
  return successResponse(session);
}

/** GET /setup: whether this deployment still needs its first circle (before sign-in). */
export async function getSetup(): Promise<APIGatewayProxyResult> {
  return successResponse({ unstarted: await isUnstarted() });
}

/**
 * POST /auth/start {googleIdToken, name, circle: {name, kind, themeId?}}
 * The first sign-in on a brand-new deployment starts its first circle, with
 * them as owner (docs/decisions/0029). Only while nothing has started, and
 * only for the owner's email when one is configured.
 */
export async function startFirst(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parse(event);
  const googleIdToken = text(body?.googleIdToken);
  const name = text(body?.name);
  const c = (body?.circle ?? {}) as Body;
  const circleName = text(c.name);
  const kind = CIRCLE_KINDS.find((k) => k === c.kind);
  if (!googleIdToken || !name || !circleName || !kind)
    return errorResponse('googleIdToken, name, circle.name and circle.kind are required', 400);
  const google = await verifyGoogleToken(googleIdToken);
  if (!google) return errorResponse('Invalid or expired Google token', 401);
  if (OWNER_EMAIL && google.email.toLowerCase() !== OWNER_EMAIL)
    return errorResponse('Only the owner can start this one', 403, undefined, 'NOT_OWNER');
  if (!(await isUnstarted()))
    return errorResponse('This has already been started', 409, undefined, 'STARTED');
  await startFirstCircle(
    { name: circleName.slice(0, 60), kind, themeId: text(c.themeId) },
    { email: google.email, name: name.slice(0, 40) },
  );
  const session = await sessionFor(google, { isNewLink: true });
  if (!session) return errorResponse('Could not open the new circle', 500);
  return successResponse(session);
}

/** GET /me/circles: every circle the caller is in, and which one this is. */
export async function getMyCircles(
  _event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  return successResponse({ circles: await circlesOf(caller.email), current: caller.circle.id });
}

/** POST /me/circles {passphrase}: join one more circle while signed in. */
export async function joinCircle(
  event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const passphrase = text(parse(event)?.passphrase);
  if (!passphrase) return errorResponse('Missing passphrase', 400);
  const link = await linkByPassphrase(caller.email, passphrase);
  // Already signed in: a wrong passphrase is a bad answer (422), not a lost
  // session (401, which signs the app out).
  if (!link.ok)
    return errorResponse(
      link.error,
      link.status === 401 ? 422 : link.status,
      undefined,
      link.errorType,
    );
  const circles = await rebuildMemberships(caller.email);
  return successResponse({ circles, joined: link.circle.id, userId: link.userId });
}

// ── Admin › Circles: the owner starts circles ──────────────────

const KINDS = ['family', 'friends', 'mixed'] as const;
const isKind = (v: unknown): v is (typeof KINDS)[number] =>
  typeof v === 'string' && (KINDS as readonly string[]).includes(v);

/** GET /admin/circles: every circle, for the owner; whether the caller is the owner. */
export async function getCircles(
  _event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const owner = await isOwner(caller.email);
  return successResponse({ owner, circles: owner ? await listCircles() : [] });
}

/** POST /admin/circles {name, kind, themeId?, yourName}: start a circle, with the owner as its admin. */
export async function postCircle(
  event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  if (!(await isOwner(caller.email)))
    return errorResponse('Only the owner can start a circle', 403);
  const body = parse(event);
  const name = text(body?.name)?.slice(0, 60);
  const yourName = text(body?.yourName)?.slice(0, 60);
  const themeId = text(body?.themeId);
  if (!name || !yourName || !isKind(body?.kind))
    return errorResponse('name, kind and yourName are required', 400);
  if (themeId && !/^[a-z0-9-]{1,40}$/.test(themeId)) return errorResponse('Unknown theme', 400);
  const circle = await createCircle(
    { name, kind: body.kind, ...(themeId ? { themeId } : {}) },
    { email: caller.email, name: yourName },
  );
  return successResponse({ circle, circles: await circlesOf(caller.email) });
}

// ── Joining and splitting (docs/decisions/0018) ─────────────────

/** POST /admin/circles/join {name, sources: [circleId...], themeId?}: join circles, or join them again. */
export async function postJoin(
  event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const body = parse(event);
  const sources = Array.isArray(body?.sources)
    ? body.sources.filter((s): s is string => typeof s === 'string')
    : [];
  const r = await joinCircles(
    { name: text(body?.name) ?? '', sources, themeId: text(body?.themeId) },
    caller.email,
  );
  if (!r.ok) return errorResponse(r.error, r.status);
  return successResponse({
    circle: r.circle,
    again: r.again,
    circles: await circlesOf(caller.email),
  });
}

/** POST /admin/circles/split {circleId}: end a joined circle; nothing is deleted. */
export async function postSplit(
  event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const circleId = text(parse(event)?.circleId);
  if (!circleId) return errorResponse('circleId is required', 400);
  const r = await splitCircle(circleId, caller.email);
  if (!r.ok) return errorResponse(r.error, r.status);
  return successResponse({ circle: r.circle, circles: await circlesOf(caller.email) });
}

// ── Same person (docs/decisions/0018) ───────────────────────────

/** A joined circle the caller is an admin of, or why not. */
async function joinedAdmin(
  circleId: string | undefined,
  email: string,
): Promise<{ ok: true; circle: Circle } | { ok: false; res: APIGatewayProxyResult }> {
  const circle = circleId ? await findCircle(circleId) : null;
  if (!circle?.sources) return { ok: false, res: errorResponse('Not a joined circle', 400) };
  if (!(await isAdminIn(circle, email)))
    return { ok: false, res: errorResponse(`You need to be an admin in ${circle.name}`, 403) };
  return { ok: true, circle };
}

/** GET /admin/circles/same?circleId=: who might be the same person there. */
export async function getSame(
  event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const r = await joinedAdmin(event.queryStringParameters?.circleId, caller.email);
  if (!r.ok) return r.res;
  return successResponse({ suggestions: await sameSuggestions(scopeOf(r.circle)) });
}

const personIn = (v: unknown) => {
  const p = v as { circleId?: unknown; id?: unknown } | null;
  return typeof p?.circleId === 'string' && typeof p.id === 'string'
    ? { circleId: p.circleId, id: p.id }
    : null;
};

/** POST /admin/circles/same {circleId, a, b, same}: answer one suggestion. */
export async function postSame(
  event: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const body = parse(event);
  const r = await joinedAdmin(text(body?.circleId), caller.email);
  if (!r.ok) return r.res;
  const a = personIn(body?.a);
  const b = personIn(body?.b);
  if (!a || !b || typeof body?.same !== 'boolean')
    return errorResponse('a, b and same are required', 400);
  const scope = scopeOf(r.circle);
  // Only a pair that was suggested: two sign-ins are never made one by hand.
  const key = (p: { circleId: string; id: string }) => `${p.circleId}/${p.id}`;
  const asked = (await sameSuggestions(scope)).some(
    (s) =>
      (key(s.a) === key(a) && key(s.b) === key(b)) || (key(s.a) === key(b) && key(s.b) === key(a)),
  );
  if (!asked) return errorResponse('Not a pair to answer', 409);
  await answerSame(scope, a, b, body.same);
  return successResponse({ suggestions: await sameSuggestions(scope) });
}
