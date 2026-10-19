/** Threads (docs/decisions/0022): today's one question, and its answer. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { answerThread, threadsToday } from './service';

/** GET /threads/today */
export async function getThreadsToday(
  _event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  return successResponse(await threadsToday(userId));
}

/** POST /threads/answer { about, choice, when? } */
export async function postThreadAnswer(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return errorResponse('The request body is not JSON', 400);
  }
  const { about, choice, when } = body;
  if (typeof about !== 'string' || typeof choice !== 'string')
    return errorResponse('about and choice are required', 400);
  const result = await answerThread(userId, {
    about,
    choice,
    ...(typeof when === 'string' && /^\d{4}$/.test(when) ? { when } : {}),
  });
  return result.ok
    ? successResponse({ tied: result.tied, progress: result.progress })
    : errorResponse(result.error, 400);
}
