/**
 * Comments on facts, trivia answers, albums and arcade games, and the family's
 * memories of someone they remember ('memorial', keyed by person id), and
 * events (keyed by event id; only the people it's for, docs/decisions/0036).
 */
import type { CommentContentType } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import {
  addComment,
  getCommentCounts,
  getCommentThread,
  mayComment,
} from '../../services/commentsService';

const TYPES: readonly CommentContentType[] = [
  'fact',
  'trivia',
  'album',
  'arcade',
  'memorial',
  'event',
];
const MAX_IDS = 200;
const MAX_TEXT = 2000;

const typeOf = (v: unknown): CommentContentType | null =>
  TYPES.includes(v as CommentContentType) ? (v as CommentContentType) : null;
/** Ids become S3 keys, so no slashes. */
const idOf = (v: unknown): string | null =>
  typeof v === 'string' && v && !v.includes('/') ? v : null;

/** GET /comments?contentType=fact&contentId=X */
export async function getComments(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const type = typeOf(event.queryStringParameters?.contentType);
  const id = idOf(event.queryStringParameters?.contentId);
  if (!type || !id) return errorResponse('contentType and contentId are required', 400);
  if (!(await mayComment(type, id, userId))) return errorResponse('Nothing here', 404);
  return successResponse({ thread: await getCommentThread(type, id) });
}

/** GET /comments/counts?contentType=fact&ids=a,b: counts and recent commenters for badges. */
export async function getCounts(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const type = typeOf(event.queryStringParameters?.contentType);
  if (!type) return errorResponse('contentType is required', 400);
  const asked = [
    ...new Set((event.queryStringParameters?.ids ?? '').split(',').filter((i) => idOf(i))),
  ].slice(0, MAX_IDS);
  const open = await Promise.all(asked.map((id) => mayComment(type, id, userId)));
  return successResponse(
    await getCommentCounts(
      type,
      asked.filter((_, i) => open[i]),
    ),
  );
}

/** POST /comments {contentType, contentId, text, parentId?}: the caller comments. */
export async function postComment(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let body: { contentType?: unknown; contentId?: unknown; text?: unknown; parentId?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return errorResponse('Body must be JSON', 400);
  }
  const type = typeOf(body.contentType);
  const id = idOf(body.contentId);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!type || !id) return errorResponse('contentType and contentId are required', 400);
  if (!(await mayComment(type, id, userId))) return errorResponse('Nothing here', 404);
  if (!text) return errorResponse('Write something first', 400);
  if (text.length > MAX_TEXT) return errorResponse(`Keep it under ${MAX_TEXT} characters`, 400);
  const parentId = typeof body.parentId === 'string' ? body.parentId : undefined;
  return successResponse(
    await addComment({ contentType: type, contentId: id, userId, text, parentId }),
    201,
  );
}
