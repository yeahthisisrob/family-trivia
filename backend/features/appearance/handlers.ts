/**
 * The family's appearance settings: the theme everyone sees unless they pick
 * their own. Theme ids are validated by the web app's registry; the API only
 * stores a short id.
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { requireAdmin } from '../../services/adminAuth';
import { getJson, putJson } from '../../services/s3';

const KEY = 'config/appearance.json';
export interface FamilyAppearance {
  themeId: string | null;
}

export async function getAppearance(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const stored = await getJson<FamilyAppearance>(KEY);
  return successResponse({ themeId: stored?.themeId ?? null });
}

export async function saveAppearance(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  const { themeId } = JSON.parse(event.body || '{}') as { themeId?: unknown };
  if (themeId !== null && (typeof themeId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(themeId))) {
    return errorResponse('themeId must be a theme id or null', 400);
  }
  await putJson(KEY, { themeId });
  return successResponse({ themeId });
}
