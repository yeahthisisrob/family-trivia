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
import { loadJoined } from '../../services/family/joined';
import { loadFamily } from '../../services/family/roster';
import { logger } from '../../services/logger';
import { isMediaKey, readUrl } from '../../services/media';
import { getJson, putJson } from '../../services/s3';
import { readStory, writeStory } from './story';

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

/** GET /family/story: the family's story (cached) and its numbers. */
export async function getFamilyStory(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  return successResponse(await readStory((await loadJoined()).visible));
}

/** POST /admin/family/story: write the story again from the family's latest answers. */
export async function refreshFamilyStory(
  _event: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  try {
    return successResponse(await writeStory((await loadJoined()).visible));
  } catch (err) {
    logger.error('Family story failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse('The story could not be written right now. Try again in a moment.', 503);
  }
}

interface WordsEntry {
  date?: string;
  question?: string;
  answer?: string;
  skipped?: boolean;
  questionType?: string;
  timestamp?: string;
}

/** GET /family/words?personId=: someone's answers in their own words, newest first. */
export async function getWords(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.queryStringParameters?.personId ?? '';
  const family = await loadFamily();
  if (!family.people[id]) return errorResponse('Unknown person', 404);
  const facts = (await getJson<WordsEntry[]>(`facts/answers/${id}.json`)) ?? [];
  const words = facts
    .filter((f) => f.answer?.trim() && !f.skipped && f.questionType !== 'basic' && f.question)
    .sort((a, b) => (b.date ?? b.timestamp ?? '').localeCompare(a.date ?? a.timestamp ?? ''))
    .slice(0, 60)
    .map((f) => ({
      question: f.question,
      answer: f.answer,
      date: f.date ?? f.timestamp?.slice(0, 10) ?? null,
    }));
  return successResponse({ personId: id, words });
}
