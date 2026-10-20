/**
 * Invite links (docs/decisions/0020): the link page (before sign-in) and
 * Admin › Circles, where a circle's admins make links and answer joins.
 */
import { INVITE_LIFETIMES, type InviteFor, type InviteLifetime } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { requireAdmin } from '../../services/adminAuth';
import { verifyGoogleToken } from '../../services/auth';
import { findCircle, memberIn, scopeOf } from '../../services/circles';
import { loadUsers } from '../../services/family/members';
import {
  acceptInvite,
  createInvite,
  decideJoin,
  listInvites,
  listJoins,
  previewInvite,
  revokeInvite,
} from '../../services/invites';
import { inCircle } from '../../services/scope';
import { sessionFor } from '../../services/session';

type Body = Record<string, unknown>;
const parse = (event: APIGatewayProxyEvent): Body | null => {
  try {
    const b: unknown = JSON.parse(event.body || '{}');
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Body) : null;
  } catch {
    return null;
  }
};
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const isLifetime = (v: unknown): v is InviteLifetime =>
  typeof v === 'string' && v in INVITE_LIFETIMES;

// ── The link page (no sign-in yet) ──────────────────────────────

/** GET /invite?token=: the one circle this link opens, or why it doesn't. */
export async function getInvite(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const preview = await previewInvite(event.queryStringParameters?.token ?? '');
  return preview ? successResponse(preview) : errorResponse('Invite not found', 404);
}

/** POST /invite/accept {token, googleIdToken, details?}: sign in and join. */
export async function acceptInviteHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = parse(event);
  const token = text(body?.token);
  const googleIdToken = text(body?.googleIdToken);
  if (!token || !googleIdToken) return errorResponse('token and googleIdToken are required', 400);
  const google = await verifyGoogleToken(googleIdToken);
  if (!google) return errorResponse('Invalid or expired Google token', 401);

  const d = body?.details as Body | undefined;
  const details = d ? { name: text(d.name) ?? '', howWeMet: text(d.howWeMet) } : null;
  const result = await acceptInvite(token, google.email, details);
  if (!result.ok) return errorResponse(result.error, result.status, undefined, result.errorType);

  if ('pending' in result) {
    // Waiting for a yes. Someone already in other circles can still go in there.
    const session = await sessionFor(google, { isNewLink: false });
    return successResponse({ pending: true, circleName: result.circle.name, session });
  }
  const session = await sessionFor(google, { open: result.circle.id, isNewLink: result.joined });
  return successResponse({ pending: false, session });
}

// ── Admin › Circles: links and joins for the admin's circle ─────

async function asAdmin(userId: string) {
  const denied = await requireAdmin(userId);
  return denied ? errorResponse(denied, 403) : null;
}

/** GET /admin/invites: this circle's links and the joins waiting for a yes. */
export async function getInvites(
  _event: APIGatewayProxyEvent,
  userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const [invites, joins] = await Promise.all([listInvites(caller.circle.id), listJoins()]);
  return successResponse({ invites, joins });
}

/**
 * POST /admin/invites {for, lifetime, maxUses, approval, circleId?}: make a
 * link for this circle, or for another circle the caller is an admin of
 * (an owner inviting to a circle from Admin › Circles without opening it).
 */
export async function postInvite(
  event: APIGatewayProxyEvent,
  userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const body = parse(event);
  if (!body) return errorResponse('Body must be JSON', 400);
  const other = text(body.circleId);
  if (other && other !== caller.circle.id) {
    const circle = await findCircle(other);
    const there = circle && (await memberIn(circle, caller.email));
    const notAdmin =
      !circle || !there || (await inCircle(scopeOf(circle), () => requireAdmin(there)));
    if (notAdmin || !circle) return errorResponse('Only an admin of that circle can invite', 403);
    const invite = await createInvite({
      circleId: circle.id,
      for: { kind: 'anyone' },
      lifetime: isLifetime(body.lifetime) ? body.lifetime : 'week',
      maxUses: null,
      approval: body.approval === true,
      createdBy: there,
    });
    return successResponse({ invite });
  }
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const lifetime = isLifetime(body.lifetime) ? body.lifetime : 'week';
  const maxUses =
    typeof body.maxUses === 'number' && body.maxUses >= 1 ? Math.floor(body.maxUses) : null;

  let forWho: InviteFor = { kind: 'anyone' };
  const personId = text((body.for as Body | undefined)?.userId);
  if (personId) {
    const users = await loadUsers();
    if (!users.users[personId]) return errorResponse('No such person in this circle', 404);
    forWho = { kind: 'person', userId: personId };
  }
  const invite = await createInvite({
    circleId: caller.circle.id,
    for: forWho,
    lifetime,
    maxUses,
    approval: body.approval === true,
    createdBy: userId,
  });
  return successResponse({ invite });
}

/** POST /admin/invites/revoke {token}: take a link back. */
export async function postRevokeInvite(
  event: APIGatewayProxyEvent,
  userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const token = text(parse(event)?.token);
  if (!token || !(await revokeInvite(token, caller.circle.id)))
    return errorResponse('Invite not found', 404);
  return successResponse({ revoked: token });
}

/** POST /admin/joins/decide {id, approve}: let someone in, or not. */
export async function postDecideJoin(
  event: APIGatewayProxyEvent,
  userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const body = parse(event);
  const id = text(body?.id);
  if (!id || typeof body?.approve !== 'boolean')
    return errorResponse('id and approve are required', 400);
  const r = await decideJoin(caller.circle.id, id, body.approve);
  return r.ok ? successResponse(r) : errorResponse('Request not found', 404);
}
