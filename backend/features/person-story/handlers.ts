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
  type StoryMention,
  type StoryWord,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { S3_PATHS } from '../../constants';
import { getCommentCounts, getCommentThread } from '../../services/commentsService';
import { getFactHistory } from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';
import { readKnowledge } from '../../services/knowledge';
import { readRecord } from '../../services/reactions';
import { getJson } from '../../services/s3';

const LOVED = 3;

/** Most of what others said about someone to carry; the rest are on their pages. */
const MENTIONS = 40;

/**
 * Someone's story. `others` are the people whose answers may mention them
 * (the family that can be seen); none of them, and there are no mentions.
 */
export async function buildPersonStory(
  personId: string,
  others: string[] = [],
): Promise<PersonStory> {
  const [facts, trivia, mentions] = await Promise.all([
    getFactHistory(personId),
    getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(personId)).then((h) => h ?? []),
    mentionsOf(
      personId,
      others.filter((o) => o !== personId),
    ),
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
  const replies = (
    await Promise.all(
      ids
        .filter((id) => (counts[id] ?? 0) > 0)
        .map(async (on) => ({
          on,
          comments: (
            await getCommentThread('fact', on)
          ).comments.map((c) => ({
            userId: c.userId,
            text: c.text,
            timestamp: c.timestamp,
          })),
        })),
    )
  ).filter((r) => r.comments.length);

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
    mentions,
    replies,
  };
}

/**
 * The answers where the rest of the family talks about them: the person
 * items their readers linked to this person (knowledge index, `about`).
 */
async function mentionsOf(personId: string, others: string[]): Promise<StoryMention[]> {
  const found = await Promise.all(
    others.map(async (speaker) => {
      const linked = (await readKnowledge(speaker)).items.filter((i) => i.about === personId);
      if (!linked.length) return [];
      const at = new Set(linked.map((i) => i.from));
      return (await getFactHistory(speaker))
        .filter((e) => at.has(e.timestamp) && e.answer?.trim())
        .map((e) => ({
          id: `${speaker}_${e.timestamp}`,
          personId: speaker,
          question: e.question,
          answer: e.answer.trim(),
          date: e.timestamp.slice(0, 10),
        }));
    }),
  );
  return found
    .flat()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MENTIONS);
}

/** GET /family/person-story?personId=X */
export async function getPersonStory(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.queryStringParameters?.personId ?? '';
  const { visible } = await loadJoined();
  if (!visible.people[id]) return errorResponse('Unknown person', 404);
  return successResponse(await buildPersonStory(id, Object.keys(visible.people)));
}
