/**
 * The family slice: read the family, and (admins) save it.
 *
 * Every save keeps the version it replaces under family/history/, so a
 * mistake in the editor can always be undone. People's photos come back as
 * short-lived URLs; the photos themselves stay in the private bucket.
 */
import { type Family, familyProblems } from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { S3_PATHS } from '../../constants';
import { requireAdmin } from '../../services/adminAuth';
import { loadFamily } from '../../services/family/roster';
import { logger } from '../../services/logger';
import { isMediaKey, readUrl } from '../../services/media';
import { getJson, putJson } from '../../services/s3';

/** Photo keys in the family, signed for display. */
async function photoUrls(family: Family): Promise<Record<string, string>> {
  const keys = new Set<string>();
  for (const p of Object.values(family.people)) {
    if (isMediaKey(p.photo)) keys.add(p.photo as string);
    if (isMediaKey(p.memorial?.photo)) keys.add(p.memorial?.photo as string);
  }
  const entries = await Promise.all([...keys].map(async (k) => [k, await readUrl(k)] as const));
  return Object.fromEntries(entries.filter((e): e is readonly [string, string] => !!e[1]));
}

/** GET /family: everyone in the family and how they're connected. */
export async function getFamily(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const family = await loadFamily();
  return successResponse({ family, photoUrls: await photoUrls(family) });
}

/** PUT /admin/family: save the whole family (admins only). */
export async function saveFamily(
  event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);

  let family: Family;
  try {
    family = (JSON.parse(event.body || '{}') as { family: Family }).family;
  } catch {
    return errorResponse('The request body is not JSON', 400);
  }
  const problems = familyProblems(family);
  if (problems.length)
    return errorResponse('The family has problems to fix first', 400, problems.join('\n'));

  // Keep what this save replaces: the version 2 file, or the version 1
  // hierarchy the first time a family is saved in the new format.
  const previous =
    (await getJson<unknown>(S3_PATHS.FAMILY)) ??
    (await getJson<unknown>(S3_PATHS.FAMILY_HIERARCHY));
  if (previous) {
    await putJson(
      `family/history/${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
      previous,
    );
  }
  await putJson(S3_PATHS.FAMILY, family);
  logger.info('Family saved', {
    by: userId,
    people: Object.keys(family.people).length,
    ties: family.ties.length,
  });
  return successResponse({ family, photoUrls: await photoUrls(family) });
}
