/**
 * A remembered person's page (shared/src/remembering.ts): everything they
 * told the family, what the family loved most, and their trivia. Only for
 * people the family remembers; everyone else has their person page.
 */
import {
  type HistoryEntry,
  isRemembered,
  LAST_WORDS,
  type RememberedWord,
  type Remembering,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { S3_PATHS } from '../../constants';
import { getCommentCounts } from '../../services/commentsService';
import { getFactHistory } from '../../services/factHistoryService';
import { loadFamily } from '../../services/family/roster';
import { readRecord } from '../../services/reactions';
import { getJson } from '../../services/s3';

const LOVED = 3;

export async function buildRemembering(personId: string): Promise<Remembering> {
  const [facts, trivia] = await Promise.all([
    getFactHistory(personId),
    getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(personId)).then((h) => h ?? []),
  ]);

  const words: RememberedWord[] = facts
    .filter((f) => f.answered && !f.skipped && f.answer?.trim() && f.question && f.timestamp)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .map((f) => ({
      id: `${personId}_${f.timestamp}`,
      question: f.question,
      answer: f.answer.trim(),
      date: f.date || f.timestamp.slice(0, 10),
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

/** GET /family/remembering?personId=X */
export async function getRemembering(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.queryStringParameters?.personId ?? '';
  const person = (await loadFamily()).people[id];
  if (!person || !isRemembered(person))
    return errorResponse('Not someone the family remembers', 404);
  return successResponse(await buildRemembering(id));
}
