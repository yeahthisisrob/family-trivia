/**
 * The words around a season's book: a foreword and a few lines opening each
 * month, written by the 'book' AI task from the family's own answers. Written
 * once per season and tone and kept under books/, so making the book again
 * (or downloading it) never asks the AI twice. Writing it again keeps the
 * earlier writing under books/season-N/history/.
 */
import type { BookTone, BookWriting, SeasonReview } from '@family-trivia/shared';
import { invokeBedrockPrompt } from '../../services/bedrock/core/bedrockClient';
import { findJsonWithKey } from '../../services/bedrock/core/jsonInText';
import { modelFor } from '../../services/bedrock/core/models';
import { collectResponseBody } from '../../services/bedrock/core/responseParser';
import { extractTextContent } from '../../services/bedrock/core/textExtractor';
import { getJson, putJson } from '../../services/s3';

/** A time as it can sit in a file name. */
export const stamp = (iso: string) => iso.replace(/[:.]/g, '-');

export const writingKey = (season: number, tone: BookTone) =>
  `books/season-${season}/${tone}.writing.json`;

/** How much of the season the prompt may carry. */
const PROMPT_CHARS = 45_000;
const ANSWER_CHARS = 220;
const FOREWORD_CHARS = 3200;
const CHAPTER_CHARS = 800;

const VOICE: Record<Exclude<BookTone, 'plain'>, string> = {
  warm: 'Warm and plain, the way a family member would write it for everyone else. Heartfelt without being sentimental.',
  playful:
    'Light and fond: notice the running jokes, the surprises, the answers that made people laugh. Tease gently, never at anyone’s expense.',
};

export interface Remembered {
  name: string;
  died?: string;
}

export async function readWriting(season: number, tone: BookTone): Promise<BookWriting | null> {
  return getJson<BookWriting>(writingKey(season, tone));
}

export async function writeBook(
  review: SeasonReview,
  tone: Exclude<BookTone, 'plain'>,
  familyName: string,
  nameOf: (id: string) => string,
  remembered: Remembered[],
): Promise<BookWriting> {
  const months = [...new Set(review.book.map((p) => p.date.slice(0, 7)))];
  const prompt = promptFor(review, tone, familyName, nameOf, remembered, months);
  const model = modelFor('book');
  const stream = await invokeBedrockPrompt(prompt, 2000, 0.6, { task: 'book' }, model);
  const text = extractTextContent(await collectResponseBody(stream), model, 'book');
  const found = findJsonWithKey<{ foreword?: unknown; chapters?: unknown }>(text, 'foreword');
  const foreword = clean(found?.value.foreword, FOREWORD_CHARS);
  if (!foreword) throw new Error('The book’s foreword didn’t come back');
  const raw = (found?.value.chapters ?? {}) as Record<string, unknown>;
  const chapters = Object.fromEntries(
    months
      .map((m) => [m, clean(raw[m], CHAPTER_CHARS)] as const)
      .filter((e): e is readonly [string, string] => !!e[1]),
  );
  const writing: BookWriting = { tone, foreword, chapters, writtenAt: new Date().toISOString() };
  // What the AI was asked and what it said, word for word, beside what we kept of it.
  await putJson(
    `books/season-${review.season.number}/history/${tone}-${stamp(writing.writtenAt)}.ai.json`,
    { model, prompt, response: text, writtenAt: writing.writtenAt },
  );
  // The writing it replaces is kept, never lost: books made from it still point at it.
  const before = await readWriting(review.season.number, tone);
  if (before)
    await putJson(
      `books/season-${review.season.number}/history/${tone}-${stamp(before.writtenAt)}.writing.json`,
      before,
    );
  await putJson(writingKey(review.season.number, tone), writing);
  return writing;
}

/** Plain prose: trimmed, capped, and no dashes standing in for commas. */
function clean(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/[—–]/g, ', ')
    .trim()
    .slice(0, max);
}

export function promptFor(
  review: SeasonReview,
  tone: Exclude<BookTone, 'plain'>,
  familyName: string,
  nameOf: (id: string) => string,
  remembered: Remembered[],
  months: string[],
): string {
  let budget = PROMPT_CHARS;
  const days: string[] = [];
  for (const p of review.book) {
    const block = `[${p.date}] ${p.question}\n${p.answers
      .map((a) => `  ${nameOf(a.personId)}: ${a.answer.slice(0, ANSWER_CHARS)}`)
      .join('\n')}`;
    if (block.length > budget) break;
    budget -= block.length;
    days.push(block);
  }
  const lost = remembered.length
    ? `\nPeople in this season the family has since lost: ${remembered
        .map((r) => `${r.name}${r.died ? ` (died ${r.died})` : ''}`)
        .join(', ')}. If you mention them, be gentle and say only what is true here.`
    : '';

  return `You are helping a family make a printed book of one season of their family question game, "${review.season.name}". Every day the family answered the same question; the book prints every question with everyone's answers. Write the words that go around them.

The family: ${familyName}. ${review.numbers.people} people answered ${review.numbers.answers} times over ${review.numbers.days} days.${lost}

Voice: ${VOICE[tone]}
Write as the family ("we", "us"). Use people's names as written below.

Write:
1. "foreword": 180 to 280 words in 2 to 4 paragraphs (separate them with a blank line). What this season was like for the family, drawn only from the answers: what kept coming up, where people agreed, what surprised. Quote a few short phrases exactly as people wrote them.
2. "chapters": for each month ${months.join(', ')}, 2 or 3 sentences (40 to 70 words) to open that month's chapter, about that month's questions and answers.

Rules:
- Only what the answers say. Never invent events, feelings, places or relationships.
- No dashes as punctuation; use commas and full stops.
- No headings, no lists, no hashtags, no emoji.

The season, day by day:
${days.join('\n\n')}

Return only JSON: {"foreword": "...", "chapters": {"${months[0] ?? 'YYYY-MM'}": "...", ...}}`;
}
