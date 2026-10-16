/**
 * Season letters: the note a family reads when a season starts or ends.
 * Each person sees a letter once; dismissing it here remembers that on every
 * device (services/seasonService.ts).
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../config';
import { markLetterSeen } from '../services/seasonService';

export async function markSeasonLetterSeen(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}') as { seasonNumber?: unknown; kind?: unknown };
  if (typeof body.seasonNumber !== 'number' || (body.kind !== 'start' && body.kind !== 'end')) {
    return errorResponse('seasonNumber (number) and kind (start | end) are required', 400);
  }
  await markLetterSeen(userId, body.seasonNumber, body.kind);
  return successResponse({ seen: true });
}
