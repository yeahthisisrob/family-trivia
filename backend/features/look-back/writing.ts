/**
 * The story around a season's book, written by the 'book' AI task from the
 * family's own answers, in steps so no step outruns a request:
 *
 *   1. plan: a foreword, and the season's days grouped into chapters by
 *      theme, each with a title;
 *   2. then each chapter's opening, a few paragraphs telling its story,
 *      one chapter per step.
 *
 * Every step is kept under books/ as it's written, so a step that fails is
 * simply tried again, and making or downloading the book never asks the AI
 * twice. Writing it again keeps the earlier writing under history/, and
 * every AI call is kept word for word beside it.
 */
import {
  type BookChapter,
  type BookPage,
  type BookTone,
  type BookWriting,
  pageKey,
  type SeasonReview,
} from '@family-trivia/shared';
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

/** How much of the season a prompt may carry. */
const PLAN_CHARS = 40_000;
const CHAPTER_CHARS_IN = 30_000;
const ANSWER_CHARS = 200;
const FOREWORD_CHARS = 3200;
const INTRO_CHARS = 2400;
const TITLE_CHARS = 60;
const MAX_CHAPTERS = 10;

type Tone = Exclude<BookTone, 'plain'>;

const VOICE: Record<Tone, string> = {
  warm: 'Warm and plain, the way a family member would write it for everyone else. Heartfelt without being sentimental.',
  playful:
    'Light and fond: notice the running jokes, the surprises, the answers that made people laugh. Tease gently, never at anyone’s expense.',
};

const RULES = `Rules:
- Only what the answers say. Never invent events, feelings, places or relationships.
- Write as the family ("we", "us"), using people's names as written.
- Quote a few short phrases exactly as people wrote them.
- No dashes as punctuation; use commas and full stops. No headings, lists, hashtags or emoji.`;

export interface Remembered {
  name: string;
  died?: string;
}

export interface WritingContext {
  review: SeasonReview;
  tone: Tone;
  familyName: string;
  nameOf: (id: string) => string;
  remembered: Remembered[];
}

export async function readWriting(season: number, tone: BookTone): Promise<BookWriting | null> {
  return getJson<BookWriting>(writingKey(season, tone));
}

/**
 * One step of the writing: the plan if there isn't one (or `fresh`), else
 * the next chapter's opening. Returns the writing and how many chapters are
 * still to write.
 */
export async function advanceWriting(
  ctx: WritingContext,
  fresh: boolean,
): Promise<{ writing: BookWriting; left: number }> {
  const season = ctx.review.season.number;
  const kept = await readWriting(season, ctx.tone);
  if (fresh || !kept?.plan) {
    const writing = await plan(ctx);
    // The writing it replaces is kept, never lost: books made from it still point at it.
    if (kept)
      await putJson(
        `books/season-${season}/history/${ctx.tone}-${stamp(kept.writtenAt)}.writing.json`,
        kept,
      );
    await putJson(writingKey(season, ctx.tone), writing);
    return { writing, left: writing.plan?.length ?? 0 };
  }
  const next = kept.plan.findIndex((c) => !c.intro);
  if (next < 0) return { writing: kept, left: 0 };
  const chapter = kept.plan[next] as BookChapter;
  const intro = await writeIntro(ctx, chapter, kept.plan.length, next);
  const writing: BookWriting = {
    ...kept,
    plan: kept.plan.map((c, i) => (i === next ? { ...c, intro } : c)),
  };
  await putJson(writingKey(season, ctx.tone), writing);
  return { writing, left: writing.plan?.filter((c) => !c.intro).length ?? 0 };
}

async function ask(ctx: WritingContext, step: string, prompt: string, maxTokens: number) {
  const model = modelFor('book');
  const stream = await invokeBedrockPrompt(prompt, maxTokens, 0.6, { task: 'book' }, model);
  const text = extractTextContent(await collectResponseBody(stream), model, 'book');
  // What the AI was asked and what it said, word for word.
  const at = new Date().toISOString();
  await putJson(
    `books/season-${ctx.review.season.number}/history/${ctx.tone}-${stamp(at)}-${step}.ai.json`,
    { model, step, prompt, response: text, at },
  );
  return text;
}

const block = (p: BookPage, nameOf: (id: string) => string, i?: number) =>
  `${i === undefined ? '' : `[${i}] `}${p.date} · ${p.question}\n${p.answers
    .map((a) => `  ${nameOf(a.personId)}: ${a.answer.slice(0, ANSWER_CHARS)}`)
    .join('\n')}`;

function within(blocks: string[], budget: number): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.length > budget) break;
    budget -= b.length;
    out.push(b);
  }
  return out.join('\n\n');
}

async function plan(ctx: WritingContext): Promise<BookWriting> {
  const { review, nameOf } = ctx;
  const days = review.book;
  const target = Math.max(2, Math.min(8, Math.round(days.length / 6)));
  const lost = ctx.remembered.length
    ? `\nPeople in this season the family has since lost: ${ctx.remembered.map((r) => r.name).join(', ')}. If you mention them, be gentle and say only what is true here.`
    : '';
  const prompt = `You are helping a family make a printed book of one season of their family question game, "${review.season.name}". Every day the family answered the same question; the book prints every question with everyone's answers, gathered into chapters.

The family: ${ctx.familyName}. ${review.numbers.people} people answered ${review.numbers.answers} times over ${review.numbers.days} days.${lost}

Voice: ${VOICE[ctx.tone]}

Write:
1. "foreword": 200 to 300 words in 2 to 4 paragraphs (separate them with a blank line). What this season was like for the family, drawn only from the answers: what kept coming up, where people agreed, what surprised.
2. "chapters": about ${target} chapters that group the days by theme, so the book reads like a story rather than a calendar. Each chapter: "title" (2 to 6 plain, evocative words, like "What we'd keep forever" or "Around the table"; no colons, no numbers) and "days" (the [numbers] of its days, in the order they should be read). Every day goes in exactly one chapter. Order the chapters so the book flows.

${RULES}

The season's days:
${within(
  days.map((p, i) => block(p, nameOf, i)),
  PLAN_CHARS,
)}

Answer in two parts, nothing else:
<foreword>
the foreword, as plain prose
</foreword>
<chapters>
[{"title": "...", "days": [0, 3, 7]}, ...]
</chapters>`;
  const text = await ask(ctx, 'plan', prompt, 2000);
  // Prose comes back between tags, so quotes in it can't break anything; only the list is JSON.
  const foreword = clean(tagged(text, 'foreword'), FOREWORD_CHARS);
  if (!foreword) throw new Error('The book’s foreword didn’t come back');
  let list: unknown = null;
  try {
    list = JSON.parse(tagged(text, 'chapters') ?? 'null');
  } catch {
    list = findJsonWithKey<{ chapters?: unknown }>(text, 'chapters')?.value.chapters ?? null;
  }
  return {
    tone: ctx.tone,
    foreword,
    chapters: {},
    plan: chaptersFrom(list, days),
    writtenAt: new Date().toISOString(),
  };
}

/**
 * The AI's chapters, checked: real titles, days that exist, each day once,
 * and any day it left out placed beside its neighbour so nothing is lost.
 */
export function chaptersFrom(raw: unknown, days: BookPage[]): BookChapter[] {
  const taken = new Set<number>();
  const chapters: { title: string; days: number[] }[] = [];
  for (const c of Array.isArray(raw) ? raw.slice(0, MAX_CHAPTERS) : []) {
    const r = c as { title?: unknown; days?: unknown };
    const title = clean(r.title, TITLE_CHARS).replace(/[:.]+$/, '');
    if (!title) continue; // a chapter with no name is dropped; its days find a home below
    const mine: number[] = [];
    for (const i of (Array.isArray(r.days) ? r.days : []).map(Number)) {
      if (!Number.isInteger(i) || i < 0 || i >= days.length || taken.has(i)) continue;
      taken.add(i);
      mine.push(i);
    }
    if (mine.length) chapters.push({ title, days: mine });
  }
  if (!chapters.length) chapters.push({ title: 'Our season', days: [] });
  for (let i = 0; i < days.length; i++) {
    if (taken.has(i)) continue;
    const home =
      chapters.find((c) => c.days.includes(i - 1)) ??
      chapters.find((c) => c.days.includes(i + 1)) ??
      chapters.at(-1);
    home?.days.push(i);
    taken.add(i);
  }
  return chapters
    .filter((c) => c.days.length)
    .map((c) => ({
      title: c.title,
      pages: c.days.map((i) => pageKey(days[i] as BookPage)),
      intro: null,
    }));
}

async function writeIntro(
  ctx: WritingContext,
  chapter: BookChapter,
  total: number,
  index: number,
): Promise<string> {
  const byKey = new Map(ctx.review.book.map((p) => [pageKey(p), p]));
  const pages = chapter.pages.map((k) => byKey.get(k)).filter((p): p is BookPage => !!p);
  const prompt = `You are helping a family make a printed book of one season of their family question game, "${ctx.review.season.name}". This is chapter ${index + 1} of ${total}, "${chapter.title}". Its days follow, each question with everyone's answers; the book prints them after your opening.

Voice: ${VOICE[ctx.tone]}

Write the chapter's opening: 150 to 250 words in 2 or 3 paragraphs (separate them with a blank line), telling the story of this chapter like the start of a chapter in a memoir. Draw it only from these answers: who said what, where people agreed, what surprised, what it says about us. Lead the reader into the days that follow.

${RULES}

The chapter's days:
${within(
  pages.map((p) => block(p, ctx.nameOf)),
  CHAPTER_CHARS_IN,
)}

Answer with the opening between tags, as plain prose, nothing else:
<intro>
...
</intro>`;
  const text = await ask(ctx, `chapter-${index + 1}`, prompt, 900);
  const intro = clean(tagged(text, 'intro'), INTRO_CHARS);
  if (!intro) throw new Error('The chapter’s opening didn’t come back');
  return intro;
}

/** What's between <tag> and </tag> (or after <tag> if the reply was cut short). */
export function tagged(text: string, tag: string): string | null {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`));
  return m?.[1]?.trim() || null;
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
