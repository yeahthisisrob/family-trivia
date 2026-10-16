import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { requireAdmin } from '../../services/adminAuth';
import { buildSome, familyKnowledge } from './index';

/** GET /family/knowledge: shared themes, each person's top things and persona, and the numbers. */
export async function getKnowledge(): Promise<APIGatewayProxyResult> {
  return successResponse(await familyKnowledge());
}

/** POST /admin/knowledge/build: read the next batch of answers into the index. Call again while `left` > 0. */
export async function buildKnowledge(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  return successResponse(await buildSome());
}
