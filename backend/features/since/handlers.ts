/** POST /me/since: what's new since the caller was last here (and note that they're here now). */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse } from '../../config';
import { sinceLastVisit } from './service';

export async function postSince(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  return successResponse(await sinceLastVisit(userId));
}
