/**
 * Your picture (docs/decisions/0024): choose one from the shared library, or
 * go back to initials. It's saved on you in the people model, the one
 * versioned way, so every screen in the circle shows it.
 */
import { isAvatarChoice } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { loadFamily, storeFamily } from '../../services/family/roster';

/** PUT /me/avatar { avatar: {library, style, seed} | null } */
export async function putMyAvatar(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let avatar: unknown;
  try {
    avatar = (JSON.parse(event.body || '{}') as { avatar?: unknown }).avatar;
  } catch {
    return errorResponse('The request body is not JSON', 400);
  }
  if (avatar !== null && !isAvatarChoice(avatar))
    return errorResponse("That picture isn't one of the library's", 400);

  const family = await loadFamily();
  const me = family.people[userId];
  if (!me) return errorResponse("You're not in this circle's people yet", 404);
  const { avatar: _old, ...rest } = me;
  const next = avatar ? { ...rest, avatar } : rest;
  await storeFamily({ ...family, people: { ...family.people, [userId]: next } }, userId);
  return successResponse({ avatar: avatar ?? null });
}
