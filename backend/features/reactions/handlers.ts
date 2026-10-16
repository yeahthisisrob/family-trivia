/** Reactions on answers and family facts (shared/src/reactions.ts). */
import { isReactionId, type ReactableType } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { react, readRecord, summarize } from '../../services/reactions';

const MAX_IDS = 200;
const typeOf = (v: unknown): ReactableType | null => (v === 'fact' || v === 'trivia' ? v : null);

/** GET /reactions?contentType=fact&ids=a,b: each item's reactions, as the viewer sees them. */
export async function getReactions(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const type = typeOf(event.queryStringParameters?.contentType);
  if (!type) return errorResponse('contentType must be fact or trivia', 400);
  const ids = [
    ...new Set((event.queryStringParameters?.ids ?? '').split(',').filter(Boolean)),
  ].slice(0, MAX_IDS);
  const entries = await Promise.all(
    ids.map(async (id) => [id, summarize(await readRecord(type, id), userId)] as const),
  );
  return successResponse({ reactions: Object.fromEntries(entries) });
}

/** PUT /reactions {contentType, contentId, reaction|null}: set or take back the viewer's reaction. */
export async function putReaction(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let body: { contentType?: unknown; contentId?: unknown; reaction?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return errorResponse('Body must be JSON', 400);
  }
  const type = typeOf(body.contentType);
  const id = typeof body.contentId === 'string' ? body.contentId : '';
  if (!type || !id || id.includes('/'))
    return errorResponse('contentType and contentId are required', 400);
  if (body.reaction !== null && !isReactionId(body.reaction))
    return errorResponse('Unknown reaction', 400);
  const record = await react(type, id, userId, body.reaction);
  return successResponse({ contentId: id, summary: summarize(record, userId) });
}
