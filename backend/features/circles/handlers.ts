/**
 * Signing in, and the circles a person belongs to (docs/decisions/0015).
 * One Google sign-in, any number of circles; a passphrase joins one more.
 */
import type { MyCircle } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { signJwt, verifyGoogleToken } from '../../services/auth';
import {
  accountIdOf,
  myCircles as circlesOf,
  linkByPassphrase,
  rebuildMemberships,
} from '../../services/circles';
import { logger } from '../../services/logger';

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

/** The circle to open: the one asked for if they're in it, else their first. */
const choose = (mine: MyCircle[], wanted?: string) => mine.find((c) => c.id === wanted) ?? mine[0];

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

  const mine = await rebuildMemberships(google.email);
  const current = choose(mine, joined ?? text(body.circleId));
  if (!current) return errorResponse('Account not linked', 401, undefined, 'NOT_LINKED');

  const token = await signJwt({ sub: accountIdOf(google.email), email: google.email });
  logger.info('Signed in', { circles: mine.length, joined: joined ?? null });
  return successResponse({
    token,
    userId: current.userId,
    circleId: current.id,
    circles: mine,
    email: google.email,
    name: google.name,
    picture: google.picture,
    isNewLink: joined !== undefined,
  });
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
