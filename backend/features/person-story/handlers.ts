/**
 * Someone's story (shared/src/person-story.ts): everything they told the
 * family, what the family loved most, and their trivia. Their profile and,
 * once they're gone, their Remembering page both read it. Only for people
 * the family can see (docs/decisions/0009).
 */
import {
  type HistoryEntry,
  LAST_WORDS,
  type PersonStory,
  type StoryWord,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { S3_PATHS } from '../../constants';
import { getCommentCounts } from '../../services/commentsService';
import { getFactHistory } from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';
import { readRecord } from '../../services/reactions';
import { getJson } from '../../services/s3';

const LOVED = 3;

export async function buildPersonStory(personId: string): Promise<PersonStory> {
  const [facts, trivia] = await Promise.all([
    getFactHistory(personId),
    getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(personId)).then((h) => h ?? []),
  ]);

  const words: StoryWord[] = facts
    .filter((f) => f.answered && !f.skipped && f.answer?.trim() && f.question && f.timestamp)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((f) => ({
      id: `${personId}_${f.timestamp}`,
      question: f.question,
      answer: f.answer.trim(),
      // When they said it: an old question answered late belongs to the day it was answered.
      date: f.timestamp.slice(0, 10),
    }));

  const ids = words.map((w) => w.id);
  const [{ counts }, reactions] = await Promise.all([
    getCommentCounts('fact', ids),
    Promise.all(ids.map(async (id) => Object.keys((await readRecord('fact', id)).byUser).length)),
  ]);
  const loved = ids
    .map((id, i) => ({ id, reactions: reactions[i] ?? 0, comments: counts[id] ?? 0 }))
    .filter((l) => l.reactions + l.comments > 0)
    .sort((a, b) => b.reactions + b.comments - (a.reactions + a.comments))
    .slice(0, LOVED);

  const days = [
    ...words.map((w) => w.date),
    ...trivia.map((t) => t.timestamp?.slice(0, 10)).filter((d): d is string => !!d),
  ].sort();

  return {
    personId,
    words,
    last: ids.slice(-LAST_WORDS).reverse(),
    loved,
    trivia: { played: trivia.length, right: trivia.filter((t) => t.correct).length },
    span: { first: days[0] ?? null, last: days.at(-1) ?? null },
  };
}

/** GET /family/person-story?personId=X */
export async function getPersonStory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.queryStringParameters?.personId ?? '';
  const { visible } = await loadJoined();
  if (!visible.people[id]) return errorResponse('Unknown person', 404);
  return successResponse(await buildPersonStory(id));
}
