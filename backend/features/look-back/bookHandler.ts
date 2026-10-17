/**
 * A season's book, made once and kept.
 *
 *   POST /seasons/book/writing {season, tone, fresh?}  the foreword and chapter
 *        openings (writing.ts): kept per season and tone; `fresh` writes anew.
 *   POST /seasons/book {season, tone, fresh?}  the print-ready PDF (book.ts),
 *        handed back as a download link. It is made again only when the
 *        season's answers, the people or the writing changed since, or when
 *        asked to.
 *   GET /seasons/book/versions?season=N  every book made for the season.
 *
 * Nothing is replaced: each book is its own file under books/ (which the
 * family's backups keep), beside the input it was made from (the season's
 * answers, the people, the writing and the layout version), and the record
 * lists every version, newest first. Earlier writing is kept the same way,
 * with the AI's prompt and reply (writing.ts).
 *
 * Two calls, because the writing can take longer than one request may.
 */
import {
  type BookTone,
  type BookVersion,
  type BookWriting,
  chaptersLeft,
  isBookTone,
  isRemembered,
  type SeasonBook,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { loadJoined } from '../../services/family/joined';
import { logger } from '../../services/logger';
import { bookCover } from '../../services/press/cover';
import { keepBook, keptVersions } from '../../services/press/keep';
import { getBytes } from '../../services/s3';
import { getSeasonsConfig } from '../../services/seasonService';
import { type BookPerson, seasonBook, seasonSpan } from './book';
import { buildSeasonReview } from './review';
import { advanceWriting, readWriting } from './writing';

/** Bump when the layout in book.ts changes, so a kept input says which layout it was set in. */
export const LAYOUT = 5;

const prefixOf = (season: number, tone: BookTone) => `books/season-${season}/${tone}`;
const TONES: readonly BookTone[] = ['plain', 'warm', 'playful'];

function parse(event: APIGatewayProxyEvent) {
  try {
    const b = JSON.parse(event.body ?? '{}') as Record<string, unknown>;
    return {
      season: Number(b.season),
      tone: isBookTone(b.tone) ? b.tone : null,
      fresh: b.fresh === true,
    };
  } catch {
    return { season: Number.NaN, tone: null, fresh: false };
  }
}

/** The season, its review, and the family as the book sees it. */
async function gather(seasonNumber: number) {
  const { seasons } = await getSeasonsConfig();
  const season = seasons.find((s) => s.seasonNumber === seasonNumber && s.status !== 'upcoming');
  if (!season) return null;
  const [review, { visible }] = await Promise.all([
    buildSeasonReview(season, seasons),
    loadJoined(),
  ]);
  const people: Record<string, BookPerson> = Object.fromEntries(
    Object.values(visible.people).map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        remembered: isRemembered(p),
        years: p.memorial?.died
          ? `${p.born?.date ? `${p.born.date.slice(0, 4)} – ` : ''}${p.memorial.died.slice(0, 4)}`
          : null,
      },
    ]),
  );
  return { season, review, familyName: visible.name, people };
}

/**
 * One step of writing the book (writing.ts): the plan first, then a chapter's
 * opening per call. Call again while `left` is above zero.
 */
export async function makeBookWriting(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { season, tone, fresh } = parse(event);
  if (!tone) return errorResponse('Choose how the book is written', 400);
  if (tone === 'plain') return successResponse({ writing: null, left: 0, chapters: 0 });
  if (!fresh) {
    const kept = await readWriting(season, tone);
    if (kept?.plan && chaptersLeft(kept) === 0)
      return successResponse({ writing: kept, left: 0, chapters: kept.plan.length });
  }
  const found = await gather(season);
  if (!found) return errorResponse('Unknown season', 404);
  if (!found.review.book.length)
    return errorResponse('This season has no answers to print yet', 404);
  const nameOf = (id: string) => found.people[id]?.name ?? id;
  const remembered = Object.values(found.people)
    .filter((p) => p.remembered && found.review.people.some((r) => r.personId === p.id))
    .map((p) => ({ name: p.name }));
  const { writing, left } = await advanceWriting(
    { review: found.review, tone, familyName: found.familyName, nameOf, remembered },
    fresh,
  );
  logger.info('Season book writing', { season, tone, left });
  return successResponse({ writing, left, chapters: writing.plan?.length ?? 0 });
}

export async function makeSeasonBook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { season, tone, fresh } = parse(event);
  if (!tone) return errorResponse('Choose how the book is written', 400);
  const found = await gather(season);
  if (!found) return errorResponse('Unknown season', 404);
  const { season: seasonInfo, review, familyName, people } = found;
  if (!review.book.length) return errorResponse('This season has no answers to print yet', 404);

  const writing: BookWriting | null = tone === 'plain' ? null : await readWriting(season, tone);
  if (tone !== 'plain' && chaptersLeft(writing) > 0)
    return errorResponse('The book isn’t fully written yet', 409);

  const kept = await keepBook({
    prefix: prefixOf(season, tone),
    input: { layout: LAYOUT, tone, familyName, people, review, writing },
    fileName: `${familyName} - ${review.season.name}.pdf`.replace(/[^\p{L}\p{N} .-]/gu, ''),
    fresh,
    about: { tone, writtenAt: writing?.writtenAt ?? null },
    make: () => seasonBook({ review, familyName, people, writing }),
    cover: async (pages) => {
      const image = seasonInfo.notes?.end?.image ?? seasonInfo.notes?.start?.image;
      const n = review.numbers;
      return bookCover({
        title: review.season.name,
        family: familyName,
        subtitle: 'in our own words',
        dates: seasonSpan(review),
        blurb:
          writing?.foreword.split(/\n\s*\n/)[0]?.trim() ||
          `Every day of ${review.season.name}, the family answered the same question. These are the questions, and every answer, in our own words.`,
        numbers: `${n.people} of us · ${n.answers.toLocaleString('en-US')} answers · ${n.days} days`,
        photo: image ? await getBytes(image) : null,
        pages,
      });
    },
  });
  if (kept.made) logger.info('Season book made', { season, tone, pages: kept.pages });
  const book: SeasonBook = { ...kept, tone };
  return successResponse(book);
}

/** GET /seasons/book/versions?season=N: every book made for the season, newest first. */
export async function listBookVersions(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const season = Number(event.queryStringParameters?.season);
  if (!Number.isFinite(season)) return errorResponse('Which season?', 400);
  const { seasons } = await getSeasonsConfig();
  const name = seasons.find((s) => s.seasonNumber === season)?.name ?? `Season ${season}`;
  const all = await Promise.all(
    TONES.map(async (tone) =>
      (
        await keptVersions(
          prefixOf(season, tone),
          (v) => `${name} - ${tone} - ${v.madeAt.slice(0, 10)}.pdf`,
        )
      ).map(
        (v): BookVersion => ({
          tone,
          madeAt: v.madeAt,
          pages: v.pages,
          writtenAt: v.about?.writtenAt ?? null,
          url: v.url,
          ...(v.coverUrl ? { coverUrl: v.coverUrl } : {}),
        }),
      ),
    ),
  );
  const versions = all.flat().sort((a, b) => b.madeAt.localeCompare(a.madeAt));
  return successResponse({ versions });
}
