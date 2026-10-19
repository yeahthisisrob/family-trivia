/**
 * Your picture (docs/decisions/0024): one the AI made for you, or an animal,
 * or back to initials. It's saved on you in the people model, the one
 * versioned way, so every screen in the circle shows it.
 */
import { isAiAvatarKeyOf, isAvatarChoice } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { loadFamily, storeFamily } from '../../services/family/roster';
import { fileExists } from '../../services/s3';
import { makePicture } from './pictures';

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
  // A picture made for someone is theirs alone, and has to have been made.
  if (
    avatar?.library === 'ai' &&
    (!isAiAvatarKeyOf(userId, avatar.key) || !(await fileExists(avatar.key)))
  )
    return errorResponse('That picture wasn’t made for you', 400);

  const family = await loadFamily();
  const me = family.people[userId];
  if (!me) return errorResponse("You're not in this circle's people yet", 404);
  const { avatar: _old, ...rest } = me;
  const next = avatar ? { ...rest, avatar } : rest;
  await storeFamily({ ...family, people: { ...family.people, [userId]: next } }, userId);
  return successResponse({ avatar: avatar ?? null });
}

/** POST /me/avatar/make { hint? }: an AI picture for me, to look at before using. */
export async function postMakePicture(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  let hint: unknown;
  try {
    hint = (JSON.parse(event.body || '{}') as { hint?: unknown }).hint;
  } catch {
    return errorResponse('The request body is not JSON', 400);
  }
  const r = await makePicture(userId, typeof hint === 'string' ? hint : undefined);
  return r.ok
    ? successResponse({ key: r.key, url: r.url, left: r.left })
    : errorResponse(r.error, r.status);
}
