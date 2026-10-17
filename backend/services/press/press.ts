/**
 * The press: what every printed book in the app shares. A 6 × 9 inch page a
 * print-on-demand press takes as it is, EB Garamond embedded (OFL, fonts/),
 * margins wide enough for any binding, and the conventions of a book: front
 * matter without numbers, chapters with running heads (the book's title on
 * the left, the chapter on the right) and page numbers at the foot, nothing
 * on a chapter's first page but its number, and an even number of pages.
 * No half title, no copyright page, and no blank pages to land chapters on
 * the right: the family reads these on phones far more than on paper.
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
export const MEASURE = TRIM.width - MARGIN.inside - MARGIN.outside;
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
  /** Opens a chapter on the next page. Its body pages carry `title` as their head. */
  chapter(title: string, opts?: { kicker?: string; note?: string; noteFace?: Face }): number;
  contents(at: number, entries: { label: string; at: number }[]): void;
  finish(): Promise<{ pdf: Buffer; pages: number }>;
}

export function press(info: { title: string; author: string }): Press {
  const doc = new PDFDocument({
    size: [TRIM.width, TRIM.height],
    margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.inside, right: MARGIN.outside },
    // Starting on an embedded font keeps pdfkit from loading its built-in ones.
    font: font('Regular'),
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: info.title, Author: info.author, Creator: 'Family Trivia' },
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

  let finishing = false;
  doc.on('pageAdded', () => {
    doc.x = MARGIN.inside;
    if (bodyFrom >= 0 && !finishing) heads.set(doc.bufferedPageRange().count - 1, chapterTitle);
  });

  const p: Press = {
    doc,
    page() {
      doc.addPage();
      doc.x = MARGIN.inside;
      doc.y = MARGIN.top;
      return doc.bufferedPageRange().count - 1;
    },
    room: () => TRIM.height - MARGIN.bottom - doc.y,
    need(height) {
      if (p.room() < height) p.page();
    },
    center(text, size, face = 'body', opts = {}) {
      doc.fontSize(size).fillColor(INK);
      p.say(curly(text), face, MARGIN.inside, doc.y, { width: MEASURE, align: 'center', ...opts });
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
        p.say(para, face, MARGIN.inside, doc.y, { width: MEASURE, align: 'justify', lineGap: 2 });
        doc.moveDown(0.7);
      }
    },
    rule() {
      const y = doc.y + 4;
      doc
        .moveTo(TRIM.width / 2 - 24, y)
        .lineTo(TRIM.width / 2 + 24, y)
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
      const at = p.page();
      if (first) bodyFrom = at;
      heads.set(at, title);
      openers.add(at);
      doc.y = TRIM.height * 0.22;
      if (opts.kicker) {
        p.center(opts.kicker, 10, 'body', { features: ['smcp'], characterSpacing: 2 });
        doc.moveDown(0.5);
      }
      p.center(title, 26, 'body');
      doc.moveDown(0.4);
      p.rule();
      doc.moveDown(1.5);
      if (opts.note?.trim()) {
        p.paragraphs(opts.note, 11.5, opts.noteFace ?? 'italic');
        doc.moveDown(0.8);
        p.rule();
        doc.moveDown(1.2);
      } else doc.moveDown(0.5);
      return at;
    },
    contents(at, entries) {
      doc.switchToPage(at);
      doc.y = TRIM.height * 0.18;
      p.center('Contents', 18, 'body');
      doc.moveDown(1.5);
      for (const e of entries) {
        const y = doc.y;
        doc
          .font('body')
          .fontSize(12)
          .fillColor(INK)
          .text(curly(e.label), MARGIN.inside, y, { width: MEASURE - 40 });
        doc.text(String(e.at - bodyFrom + 1), MARGIN.inside, y, { width: MEASURE, align: 'right' });
        doc.moveDown(0.6);
      }
    },
    async finish() {
      // A book ends on a left-hand page.
      if (doc.bufferedPageRange().count % 2 === 1) blanks.add(p.page());
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
              width: MEASURE,
              align: 'center',
              lineBreak: false,
            });
        doc
          .font('body')
          .fontSize(9.5)
          .fillColor(SOFT)
          .text(String(at - bodyFrom + 1), MARGIN.inside, TRIM.height - MARGIN.bottom + 24, {
            width: MEASURE,
            align: 'center',
            lineBreak: false,
          });
        doc.page.margins = margins;
      }
      const pages = doc.bufferedPageRange().count;
      doc.end();
      return { pdf: await done, pages };
    },
  };
  return p;
}
