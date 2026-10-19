/**
 * Signing in, and the circles a person belongs to (docs/decisions/0015).
 * One Google sign-in, any number of circles; a passphrase joins one more.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { verifyGoogleToken } from '../../services/auth';
import {
  myCircles as circlesOf,
  createCircle,
  isOwner,
  linkByPassphrase,
  listCircles,
  rebuildMemberships,
} from '../../services/circles';
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
