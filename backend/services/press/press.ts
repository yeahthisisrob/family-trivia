/**
 * The press: what every printed book in the app shares. A 6 × 9 inch page a
 * print-on-demand press takes as it is, EB Garamond embedded (OFL, fonts/),
 * margins wide enough for any binding, and the conventions of a book: front
 * matter without numbers, chapters with running heads (the book's title on
 * the left, the chapter on the right) and page numbers at the foot, nothing
 * on a chapter's first page but its number, and an even number of pages.
 * No half title, no copyright page, and no blank pages to land chapters on
 * the right: the family reads these on phones far more than on paper. A
 * chapter that begins with most of a page still empty begins there.
 *
 * A book is fitted, not just set: fitted() lays it out at a few sizes (the
 * type, spacing and margins scaled together, on the same 6 × 9 page) and
 * keeps the one that leaves the fewest pages with almost nothing on them.
 * Emoji are drawn from Noto Emoji (OFL), since Garamond has none.
 *
 * A book is written top to bottom with the helpers below, then finish()
 * fills in the heads and numbers and hands back the PDF.
 */
import path from 'node:path';
import { BOOK_PAGE } from '@family-trivia/shared';
import PDFDocument from 'pdfkit';

export const TRIM = { width: BOOK_PAGE.width, height: BOOK_PAGE.height };
export const MARGIN = BOOK_PAGE.margin;
export const INK = '#1d1a16';
export const SOFT = '#5a5148';

// In the Lambda the fonts sit beside the bundle (infra copies them there).
const FONTS = process.env.BOOK_FONTS_DIR ?? path.join(__dirname, 'fonts');
const font = (f: string) => path.join(FONTS, `EBGaramond-${f}.ttf`);

/** Emoji, but not the © ® ™ Garamond already has. */
const PICTO = /(?![©®™])\p{Extended_Pictographic}+/gu;

/**
 * Text as runs of letters and of emoji. Noto's plain emoji draws each
 * symbol on its own, so what joins or tints them (variation selectors, skin
 * tones, the joiner and what it joins, as in a shrug's ♀) is dropped.
 */
export function emojiRuns(text: string): { text: string; emoji: boolean }[] {
  const s = text
    .replace(/[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\u200D\p{Extended_Pictographic}?/gu, '');
  const runs: { text: string; emoji: boolean }[] = [];
  let last = 0;
  for (const m of s.matchAll(PICTO)) {
    if (m.index > last) runs.push({ text: s.slice(last, m.index), emoji: false });
    runs.push({ text: m[0], emoji: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) runs.push({ text: s.slice(last), emoji: false });
  return runs;
}

const NUMBER_WORDS = [
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
  'Twenty',
];
export const numberWord = (n: number) => NUMBER_WORDS[n - 1] ?? String(n);

/** Printers' quotes and apostrophes: “like this” and don’t. */
export const curly = (s: string) =>
  s
    .replace(/(^|[\s([{“])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{“])'/g, '$1‘')
    .replace(/'/g, '’');

export const monthName = (ym: string) =>
  new Date(`${ym.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
export const dayName = (d: string, withYear = false) =>
  new Date(`${d.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  });

export type Face = 'body' | 'italic' | 'bold';

export interface Press {
  doc: PDFKit.PDFDocument;
  /** A new page; returns its index. */
  page(): number;
  room(): number;
  /** Turn the page if less than `height` is left. */
  need(height: number): void;
  center(text: string, size: number, face?: Face, opts?: PDFKit.Mixins.TextOptions): void;
  paragraphs(text: string, size: number, face?: Face): void;
  /** Text that may hold emoji, at (x, y) or where the last text ended. */
  say(text: string, face: Face, x: number, y: number, opts?: PDFKit.Mixins.TextOptions): void;
  rule(): void;
  /** Leaves a page for the contents; fill it with contents(). */
  reserveContents(): number;
  /**
   * Opens a chapter: on the next page, or lower on this one when most of it
   * is still empty. Its body pages carry `title` as their head.
   */
  chapter(title: string, opts?: { kicker?: string; note?: string; noteFace?: Face }): number;
  contents(at: number, entries: { label: string; at: number }[]): void;
  finish(): Promise<Laid>;
  /** The page as this layout sees it: 6 × 9 inches divided by its scale. */
  trim: { width: number; height: number };
  /** The text block's width on that page. */
  measure: number;
}

export interface Laid {
  pdf: Buffer;
  pages: number;
  /** Pages with almost nothing on them (title and blank pages aside). */
  sparse: number;
  /** The size it was set at: 1 as designed, above 1 larger. */
  scale: number;
  /** Whether it took a blank last page to end on a left-hand page. */
  padded: boolean;
}

/** A page this empty or emptier, as a share of its text block, is sparse. */
const SPARSE = 0.33;
/** A chapter begins on the same page when at least this much of it is free. */
const RUN_ON = 0.5;
/** The sizes fitted() tries, nearest the design first. */
const SCALES = [1, 0.94, 1.06, 0.89, 1.12];

/** How far a layout is from right: near-empty pages most, then a blank last page. */
const misfit = (l: Laid) => l.sparse * 2 + (l.padded ? 1 : 0);

/** The book laid out at each size in turn; the first that fits best wins. */
export async function fitted(make: (scale: number) => Promise<Laid>): Promise<Laid> {
  let best: Laid | null = null;
  for (const scale of SCALES) {
    const laid = await make(scale);
    if (!best || misfit(laid) < misfit(best)) best = laid;
    if (misfit(best) === 0) break;
  }
  return best as Laid;
}

export function press(info: { title: string; author: string; scale?: number }): Press {
  // Laid out on a page 1/scale the size, then drawn scaled to the real page:
  // type, spacing and margins all grow or shrink together.
  const scale = info.scale ?? 1;
  const trim = { width: TRIM.width / scale, height: TRIM.height / scale };
  const measure = trim.width - MARGIN.inside - MARGIN.outside;
  const block = trim.height - MARGIN.top - MARGIN.bottom;
  const doc = new PDFDocument({
    size: [trim.width, trim.height],
    margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.inside, right: MARGIN.outside },
    // Starting on an embedded font keeps pdfkit from loading its built-in ones.
    font: font('Regular'),
    bufferPages: true,
    autoFirstPage: false,
    // The app reads the scale back to find the words on a page (frontend book-reader).
    info: {
      Title: info.title,
      Author: info.author,
      Creator: 'Family Trivia',
      Keywords: `press-scale:${scale}`,
    },
  });
  doc.registerFont('body', font('Regular'));
  doc.registerFont('italic', font('Italic'));
  doc.registerFont('bold', font('SemiBold'));
  doc.registerFont('emoji', path.join(FONTS, 'NotoEmoji-Regular.ttf'));
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  const heads = new Map<number, string>();
  const openers = new Set<number>();
  const blanks = new Set<number>();
  let chapterTitle = '';
  let chapters = 0;
  let bodyFrom = -1;

  /** How far down each page its words reach. */
  const reach = new Map<number, number>();
  const current = () => doc.bufferedPageRange().count - 1;

  let finishing = false;
  doc.on('pageAdded', () => {
    doc.x = MARGIN.inside;
    // pdfkit flips each page to put y = 0 at the top of the page it was made
    // with; scaling about that top, then lifting by the difference in height,
    // lands the top of the laid-out page on the top of the real one.
    if (scale !== 1) doc.transform(scale, 0, 0, scale, 0, trim.height - TRIM.height);
    const at = current();
    // A page the text ran off the bottom of is full.
    if (at > 0 && !reach.has(at - 1)) reach.set(at - 1, trim.height - MARGIN.bottom);
    if (bodyFrom >= 0 && !finishing) heads.set(at, chapterTitle);
  });

  const p: Press = {
    doc,
    trim,
    measure,
    page() {
      if (doc.bufferedPageRange().count) reach.set(current(), doc.y);
      doc.addPage();
      doc.x = MARGIN.inside;
      doc.y = MARGIN.top;
      return doc.bufferedPageRange().count - 1;
    },
    room: () => trim.height - MARGIN.bottom - doc.y,
    need(height) {
      if (p.room() < height) p.page();
    },
    center(text, size, face = 'body', opts = {}) {
      doc.fontSize(size).fillColor(INK);
      p.say(curly(text), face, MARGIN.inside, doc.y, { width: measure, align: 'center', ...opts });
    },
    say(text, face, x, y, opts = {}) {
      const runs = emojiRuns(text);
      if (!runs.some((r) => r.emoji)) {
        doc.font(face).text(text, x, y, opts);
        return;
      }
      // pdfkit can't justify a line made of several runs; such a paragraph sits flush left.
      const o = { ...opts, align: opts.align === 'justify' ? 'left' : opts.align };
      runs.forEach((r, i) => {
        doc.font(r.emoji ? 'emoji' : face);
        const more = { ...o, continued: i < runs.length - 1 };
        if (i === 0) doc.text(r.text, x, y, more);
        else doc.text(r.text, more);
      });
      doc.font(face);
    },
    paragraphs(text, size, face = 'body') {
      for (const para of curly(text)
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean)) {
        doc.fontSize(size).fillColor(INK);
        p.say(para, face, MARGIN.inside, doc.y, { width: measure, align: 'justify', lineGap: 2 });
        doc.moveDown(0.7);
      }
    },
    rule() {
      const y = doc.y + 4;
      doc
        .moveTo(trim.width / 2 - 24, y)
        .lineTo(trim.width / 2 + 24, y)
        .lineWidth(0.6)
        .strokeColor(SOFT)
        .stroke();
      doc.y = y + 4;
    },
    reserveContents: () => p.page(),
    chapter(title, opts = {}) {
      chapterTitle = title;
      const first = chapters === 0;
      chapters += 1;
      if (bodyFrom < 0) bodyFrom = Number.POSITIVE_INFINITY; // heads start with this chapter
      if (!first && p.room() >= block * RUN_ON) {
        // Most of the page is free: the chapter begins here, below a little air.
        doc.y += 36;
        const at = current();
        if (opts.kicker) {
          p.center(opts.kicker, 9, 'body', { features: ['smcp'], characterSpacing: 2 });
          doc.moveDown(0.3);
        }
        p.center(title, 22, 'body');
        doc.moveDown(0.3);
        p.rule();
        doc.moveDown(1);
        if (opts.note?.trim()) {
          p.paragraphs(opts.note, 11.5, opts.noteFace ?? 'italic');
          doc.moveDown(0.6);
        }
        return at;
      }
      const at = p.page();
      if (first) bodyFrom = at;
      heads.set(at, title);
      openers.add(at);
      doc.y = trim.height * 0.14;
      if (opts.kicker) {
        p.center(opts.kicker, 10, 'body', { features: ['smcp'], characterSpacing: 2 });
        doc.moveDown(0.5);
      }
      p.center(title, 26, 'body');
      doc.moveDown(0.4);
      p.rule();
      doc.moveDown(1.2);
      if (opts.note?.trim()) {
        p.paragraphs(opts.note, 11.5, opts.noteFace ?? 'italic');
        doc.moveDown(0.6);
        p.rule();
        doc.moveDown(1);
      }
      return at;
    },
    contents(at, entries) {
      doc.switchToPage(at);
      doc.y = trim.height * 0.18;
      p.center('Contents', 18, 'body');
      doc.moveDown(1.5);
      for (const e of entries) {
        const y = doc.y;
        doc
          .font('body')
          .fontSize(12)
          .fillColor(INK)
          .text(curly(e.label), MARGIN.inside, y, { width: measure - 40 });
        doc.text(String(e.at - bodyFrom + 1), MARGIN.inside, y, { width: measure, align: 'right' });
        doc.moveDown(0.6);
      }
    },
    async finish() {
      reach.set(current(), doc.y);
      const sparse = [...reach].filter(
        ([at, y]) => at >= bodyFrom && (y - MARGIN.top) / block < SPARSE,
      ).length;
      // A book ends on a left-hand page.
      const padded = doc.bufferedPageRange().count % 2 === 1;
      if (padded) blanks.add(p.page());
      const book = info.title;
      finishing = true; // heads and numbers go on pages that exist; nothing new is recorded
      for (const [at, chapter] of [...heads]) {
        if (at < bodyFrom || blanks.has(at)) continue;
        doc.switchToPage(at);
        // Heads and numbers sit in the margins; with the margins open, writing
        // there never turns the page (it used to, leaving blank pages behind).
        const margins = { ...doc.page.margins };
        doc.page.margins = { ...margins, top: 0, bottom: 0 };
        const left = at % 2 === 1; // index 1 is page 2, a left-hand page
        const head = openers.has(at) ? '' : left ? book : chapter;
        if (head)
          doc
            .font('italic')
            .fontSize(9)
            .fillColor(SOFT)
            .text(curly(head), MARGIN.inside, MARGIN.top - 30, {
              width: measure,
              align: 'center',
              lineBreak: false,
            });
        doc
          .font('body')
          .fontSize(9.5)
          .fillColor(SOFT)
          .text(String(at - bodyFrom + 1), MARGIN.inside, trim.height - MARGIN.bottom + 24, {
            width: measure,
            align: 'center',
            lineBreak: false,
          });
        doc.page.margins = margins;
      }
      const pages = doc.bufferedPageRange().count;
      if (scale !== 1)
        // Laid out on the smaller or larger page, drawn scaled: every page is 6 × 9.
        for (let at = 0; at < pages; at++) {
          doc.switchToPage(at);
          (
            doc.page as unknown as { dictionary: { data: { MediaBox: number[] } } }
          ).dictionary.data.MediaBox = [0, 0, TRIM.width, TRIM.height];
        }
      doc.end();
      return { pdf: await done, pages, sparse, scale, padded };
    },
  };
  return p;
}
