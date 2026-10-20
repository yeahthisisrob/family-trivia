/** Plans (docs/decisions/0026): the weeks ahead, drop in, take back, I'm in. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { afterPlans, answerPlan, dropIn, rememberPlan, removeDrop, viewPlans } from './service';

const body = (e: APIGatewayProxyEvent): Record<string, unknown> | null => {
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
export async function postRemovePlan(e: APIGatewayProxyEvent, userId: string) {
  const id = body(e)?.id;
  if (typeof id !== 'string') return errorResponse('id is required', 400);
  return (await removeDrop(userId, id))
    ? successResponse({ removed: true })
    : errorResponse('Not one of yours', 404);
}

/** POST /plans/rsvp { id, answer: 'in' | 'out' | null } */
export async function postRsvp(e: APIGatewayProxyEvent, userId: string) {
  const b = body(e);
  const answer = b?.answer;
  if (typeof b?.id !== 'string' || !(answer === 'in' || answer === 'out' || answer === null))
    return errorResponse('id and answer (in, out or null) are required', 400);
  return (await answerPlan(userId, b.id, answer))
    ? successResponse({ ok: true })
    : errorResponse('No such plan', 404);
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
