/** Your world (docs/decisions/0018): GET /me/world, for the caller alone. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse } from '../../config';
import type { Caller } from '../../middleware/requireAuth';
import { yourWorld } from './service';

export async function getWorld(
  _e: APIGatewayProxyEvent,
  _userId: string,
  caller: Caller,
): Promise<APIGatewayProxyResult> {
  return successResponse(await yourWorld(caller.email));
}
