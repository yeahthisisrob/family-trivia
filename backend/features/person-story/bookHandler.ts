/**
 * Someone's words as a printed book (book.ts), kept like every book
 * (services/press/keep.ts): made again only when their words, the family's
 * memories or their dedication changed, and never replaced.
 *
 *   POST /family/person-book {personId, fresh?}
 *   GET  /family/person-book/versions?personId=X
 */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { getCommentThread } from '../../services/commentsService';
import { loadJoined } from '../../services/family/joined';
import { logger } from '../../services/logger';
import { isMediaKey } from '../../services/media';
import { bookCover } from '../../services/press/cover';
import { keepBook, keptVersions } from '../../services/press/keep';
import { getBytes } from '../../services/s3';
import { personBook } from './book';
import { buildPersonStory } from './handlers';

/** Bump when the layout in book.ts changes. */
const LAYOUT = 2;
const prefixOf = (personId: string) => `books/people/${personId}`;

export async function makePersonBook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  let body: { personId?: unknown; fresh?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return errorResponse('Body must be JSON', 400);
  }
  const id = typeof body.personId === 'string' ? body.personId : '';
  const { visible } = await loadJoined();
  const person = visible.people[id];
  if (!person) return errorResponse('Unknown person', 404);

  const [story, thread] = await Promise.all([
    buildPersonStory(id, Object.keys(visible.people)),
    person.memorial ? getCommentThread('memorial', id) : Promise.resolve(null),
  ]);
  if (!story.words.length) return errorResponse(`${person.name} hasn’t shared anything yet`, 404);

  const died = person.memorial?.died;
  const years = died
    ? `${person.born?.date ? `${person.born.date.slice(0, 4)} – ` : ''}${died.slice(0, 4)}`
    : null;
  const memories = thread?.comments ?? [];
  const nameOf = Object.fromEntries(Object.values(visible.people).map((p) => [p.id, p.name]));
  const input = {
    name: person.name,
    years,
    dedication: person.memorial?.dedication ?? null,
    remembered: !!person.memorial,
    familyName: visible.name,
    story,
    memories,
    nameOf,
  };
  const kept = await keepBook({
    prefix: prefixOf(id),
    input: { layout: LAYOUT, ...input },
    fileName: `${person.name} - in their own words.pdf`.replace(/[^\p{L}\p{N} .-]/gu, ''),
    fresh: body.fresh === true,
    make: (madeOn) => personBook({ ...input, madeOn }),
    cover: async (pages) => {
      const photoKey = person.memorial?.photo ?? person.photo;
      return bookCover({
        title: person.name,
        family: visible.name,
        subtitle: `in ${person.name}’s own words`,
        dates: years,
        blurb: [
          person.memorial?.dedication,
          person.memorial
            ? `Every answer ${person.name} gave the family, the last things they told us, and the family’s memories of them.`
            : `Every answer ${person.name} has given the family, in their own words.`,
        ]
          .filter(Boolean)
          .join('\n\n'),
        numbers: `${story.words.length} answers${memories.length ? ` · ${memories.length} memories` : ''}`,
        photo: photoKey && isMediaKey(photoKey) ? await getBytes(photoKey) : null,
        pages,
      });
    },
  });
  if (kept.made) logger.info('Person book made', { personId: id, pages: kept.pages });
  return successResponse(kept);
}

export async function listPersonBooks(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.queryStringParameters?.personId ?? '';
  const { visible } = await loadJoined();
  const person = visible.people[id];
  if (!person) return errorResponse('Unknown person', 404);
  const versions = await keptVersions(
    prefixOf(id),
    (v) => `${person.name} - ${v.madeAt.slice(0, 10)}.pdf`,
  );
  return successResponse({
    versions: versions.map((v) => ({
      madeAt: v.madeAt,
      pages: v.pages,
      url: v.url,
      ...(v.coverUrl ? { coverUrl: v.coverUrl } : {}),
    })),
  });
}
