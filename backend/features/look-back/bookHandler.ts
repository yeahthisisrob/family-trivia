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
  isBookTone,
  isRemembered,
  type SeasonBook,
} from '@family-trivia/shared';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { loadJoined } from '../../services/family/joined';
import { logger } from '../../services/logger';
import { keepBook, keptVersions } from '../../services/press/keep';
import { getSeasonsConfig } from '../../services/seasonService';
import { type BookPerson, seasonBook } from './book';
import { buildSeasonReview } from './review';
import { readWriting, writeBook } from './writing';

/** Bump when the layout in book.ts changes, so a kept input says which layout it was set in. */
export const LAYOUT = 2;

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
  return { review, familyName: visible.name, people };
}

export async function makeBookWriting(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { season, tone, fresh } = parse(event);
  if (!tone) return errorResponse('Choose how the book is written', 400);
  if (tone === 'plain') return successResponse({ writing: null });
  if (!fresh) {
    const kept = await readWriting(season, tone);
    if (kept) return successResponse({ writing: kept });
  }
  const found = await gather(season);
  if (!found) return errorResponse('Unknown season', 404);
  if (!found.review.book.length)
    return errorResponse('This season has no answers to print yet', 404);
  const nameOf = (id: string) => found.people[id]?.name ?? id;
  const remembered = Object.values(found.people)
    .filter((p) => p.remembered && found.review.people.some((r) => r.personId === p.id))
    .map((p) => ({ name: p.name }));
  const writing = await writeBook(found.review, tone, found.familyName, nameOf, remembered);
  logger.info('Season book written', { season, tone });
  return successResponse({ writing });
}

export async function makeSeasonBook(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const { season, tone, fresh } = parse(event);
  if (!tone) return errorResponse('Choose how the book is written', 400);
  const found = await gather(season);
  if (!found) return errorResponse('Unknown season', 404);
  const { review, familyName, people } = found;
  if (!review.book.length) return errorResponse('This season has no answers to print yet', 404);

  const writing: BookWriting | null = tone === 'plain' ? null : await readWriting(season, tone);
  if (tone !== 'plain' && !writing) return errorResponse('The book isn’t written yet', 409);

  const kept = await keepBook({
    prefix: prefixOf(season, tone),
    input: { layout: LAYOUT, tone, familyName, people, review, writing },
    fileName: `${familyName} - ${review.season.name}.pdf`.replace(/[^\p{L}\p{N} .-]/gu, ''),
    fresh,
    about: { tone, writtenAt: writing?.writtenAt ?? null },
    make: (madeOn) => seasonBook({ review, familyName, people, madeOn, writing }),
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
        }),
      ),
    ),
  );
  const versions = all.flat().sort((a, b) => b.madeAt.localeCompare(a.madeAt));
  return successResponse({ versions });
}
