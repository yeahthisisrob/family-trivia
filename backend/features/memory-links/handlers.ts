/** Memory links (docs/decisions/0027): the public page, and an admin's links and waiting memories. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { requireAdmin } from '../../services/adminAuth';
import {
  addMemory,
  createLink,
  decideMemory,
  listLinks,
  previewLink,
  revokeLink,
  visitorMemories,
} from './service';

type Body = Record<string, unknown>;
const parse = (e: APIGatewayProxyEvent): Body | null => {
  try {
    const b: unknown = JSON.parse(e.body || '{}');
    return b && typeof b === 'object' && !Array.isArray(b) ? (b as Body) : null;
  } catch {
    return null;
  }
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const LIFETIMES = ['day', 'week', 'month', 'forever'] as const;

// ── The link page (no sign-in) ──

/** GET /remember?token= */
export async function getRemember(e: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const preview = await previewLink(e.queryStringParameters?.token ?? '');
  return preview ? successResponse(preview) : errorResponse('Link not found', 404);
}

/** POST /remember { token, name, how?, text } */
export async function postRemember(e: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const b = parse(e);
  const token = str(b?.token);
  const name = str(b?.name);
  const text = str(b?.text);
  if (!token || !name || !text) return errorResponse('token, name and text are required', 400);
  const r = await addMemory(token, { name, how: str(b?.how), text });
  return r.ok ? successResponse({ waiting: true }) : errorResponse(r.error, r.status);
}

// ── In the circle ──

/** GET /family/visitor-memories?personId= : the ones let in; admins also get the waiting ones. */
export async function getVisitorMemories(e: APIGatewayProxyEvent, userId: string) {
  const personId = str(e.queryStringParameters?.personId);
  if (!personId) return errorResponse('personId is required', 400);
  const admin = !(await requireAdmin(userId));
  return successResponse({ memories: await visitorMemories(personId, admin) });
}

const asAdmin = async (userId: string) => {
  const denied = await requireAdmin(userId);
  return denied ? errorResponse(denied, 403) : null;
};

/** GET /admin/memory-links?personId= */
export async function getMemoryLinks(e: APIGatewayProxyEvent, userId: string, caller: Caller) {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const personId = str(e.queryStringParameters?.personId);
  if (!personId) return errorResponse('personId is required', 400);
  return successResponse({ links: await listLinks(caller.circle.id, personId) });
}

/** POST /admin/memory-links { personId, lifetime } */
export async function postMemoryLink(e: APIGatewayProxyEvent, userId: string, caller: Caller) {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const b = parse(e);
  const personId = str(b?.personId);
  if (!personId) return errorResponse('personId is required', 400);
  const lifetime = LIFETIMES.find((l) => l === b?.lifetime) ?? 'month';
  const link = await createLink({
    circleId: caller.circle.id,
    personId,
    lifetime,
    createdBy: userId,
  });
  return link
    ? successResponse({ link })
    : errorResponse('Memory links are for someone the circle remembers', 400);
}

/** POST /admin/memory-links/revoke { token } */
export async function postRevokeMemoryLink(
  e: APIGatewayProxyEvent,
  userId: string,
  caller: Caller,
) {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const token = str(parse(e)?.token);
  return token && (await revokeLink(token, caller.circle.id))
    ? successResponse({ revoked: true })
    : errorResponse('Link not found', 404);
}

/** POST /admin/visitor-memories/decide { personId, id, approve } */
export async function postDecideMemory(e: APIGatewayProxyEvent, userId: string) {
  const denied = await asAdmin(userId);
  if (denied) return denied;
  const b = parse(e);
  const personId = str(b?.personId);
  const id = str(b?.id);
  if (!personId || !id || typeof b?.approve !== 'boolean')
    return errorResponse('personId, id and approve are required', 400);
  return (await decideMemory(personId, id, b.approve))
    ? successResponse({ ok: true })
    : errorResponse('Memory not found', 404);
}
