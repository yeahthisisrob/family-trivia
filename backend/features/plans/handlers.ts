/** Plans (docs/decisions/0026): the weeks ahead, drop in, take back, I'm in. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { unshare } from './events';
import {
  type Answer,
  afterPlans,
  answerPlan,
  dropIn,
  rememberPlan,
  removeDrop,
  viewPlans,
} from './service';

export const body = (e: APIGatewayProxyEvent): Record<string, unknown> | null => {
  try {
    const b: unknown = JSON.parse(e.body || '{}');
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

/** GET /plans */
export async function getPlans(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  return successResponse(await viewPlans(userId));
}

/** POST /plans { text } */
export async function postPlan(e: APIGatewayProxyEvent, userId: string) {
  const text = body(e)?.text;
  if (typeof text !== 'string' || !text.trim()) return errorResponse('Say what you’re doing', 400);
  return successResponse({ added: await dropIn(userId, text.trim()) });
}

/** POST /plans/remove { id } */
export async function postRemovePlan(e: APIGatewayProxyEvent, userId: string, caller: Caller) {
  const id = body(e)?.id;
  if (typeof id !== 'string') return errorResponse('id is required', 400);
  const removed = await removeDrop(userId, id);
  if (!removed) return errorResponse('Not one of yours', 404);
  await unshare(removed, { me: userId, email: caller.email, circle: caller.circle });
  return successResponse({ removed: true });
}

const ANSWERS = ['in', 'maybe', 'out'];

/** The answer in a body, null to take it back, or undefined when it isn't one. */
function answerIn(b: Record<string, unknown>): Answer | null | undefined {
  if (b.answer === null) return null;
  if (!ANSWERS.includes(b.answer as string)) return undefined;
  const guests = b.guests === undefined ? 0 : Number(b.guests);
  if (!Number.isInteger(guests) || guests < 0 || guests > 20) return undefined;
  if (b.note !== undefined && typeof b.note !== 'string') return undefined;
  return { answer: b.answer as Answer['answer'], note: b.note as string | undefined, guests };
}

/** POST /plans/rsvp { id, answer: 'in' | 'maybe' | 'out' | null, note?, guests? } */
export async function postRsvp(e: APIGatewayProxyEvent, userId: string) {
  const b = body(e);
  const answer = b ? answerIn(b) : undefined;
  if (typeof b?.id !== 'string' || answer === undefined)
    return errorResponse(
      'id and answer (in, maybe, out or null; guests 0 to 20) are required',
      400,
    );
  const saved = await answerPlan(userId, b.id, answer);
  if (saved === 'cancelled') return errorResponse('That one is cancelled', 409);
  return saved === 'saved' ? successResponse({ ok: true }) : errorResponse('No such plan', 404);
}

/** GET /plans/after: recent plans you were in, asking how they went. */
export async function getAfter(_e: APIGatewayProxyEvent, userId: string) {
  return successResponse({ plans: await afterPlans(userId) });
}

/** POST /plans/memory { id, text } or { id, skip: true } */
export async function postPlanMemory(e: APIGatewayProxyEvent, userId: string) {
  const b = body(e);
  if (typeof b?.id !== 'string') return errorResponse('id is required', 400);
  const input = b.skip === true ? 'skip' : typeof b.text === 'string' ? { text: b.text } : null;
  if (!input) return errorResponse('text or skip is required', 400);
  return (await rememberPlan(userId, b.id, input))
    ? successResponse({ plans: await afterPlans(userId) })
    : errorResponse('Not a plan you were in', 404);
}
