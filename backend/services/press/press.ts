/**
 * The press: what every printed book in the app shares. A 6 × 9 inch page a
 * print-on-demand press takes as it is, EB Garamond embedded (OFL, fonts/),
 * margins wide enough for any binding, and the conventions of a book: front
 * matter without numbers, chapters with running heads (the book's title on
 * the left, the chapter on the right) and page numbers at the foot, nothing
 * on a chapter's first page but its number, nothing at all on a blank, and
 * an even number of pages.
 *
 * A book is written top to bottom with the helpers below, then finish()
 * fills in the heads and numbers and hands back the PDF.
 */
import path from 'node:path';
import PDFDocument from 'pdfkit';

const INCH = 72;
export const TRIM = { width: 6 * INCH, height: 9 * INCH };
export const MARGIN = {
  top: 0.85 * INCH,
  bottom: 0.9 * INCH,
  inside: 0.8 * INCH,
  outside: 0.8 * INCH,
};
export const MEASURE = TRIM.width - MARGIN.inside - MARGIN.outside;
export const INK = '#1d1a16';
export const SOFT = '#5a5148';

// In the Lambda the fonts sit beside the bundle (infra copies them there).
const FONTS = process.env.BOOK_FONTS_DIR ?? path.join(__dirname, 'fonts');
const font = (f: string) => path.join(FONTS, `EBGaramond-${f}.ttf`);

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
  /** The next right-hand page, leaving a blank behind if needed. */
  recto(): number;
  room(): number;
  /** Turn the page if less than `height` is left. */
  need(height: number): void;
  center(text: string, size: number, face?: Face, opts?: PDFKit.Mixins.TextOptions): void;
  paragraphs(text: string, size: number, face?: Face): void;
  rule(): void;
  /** A half title and its blank back. */
  halfTitle(title: string): void;
  /** Small print at the foot of a page. */
  colophon(lines: string[]): void;
  /** Leaves a right-hand page for the contents; fill it with contents(). */
  reserveContents(): number;
  /**
   * Opens a chapter: the first opens on a right-hand page, the rest on the
   * next page unless `recto`. Its body pages carry `title` as their head.
   */
  chapter(title: string, opts?: { kicker?: string; note?: string; recto?: boolean }): number;
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
    recto() {
      let at = p.page();
      if (at % 2 === 1) {
        blanks.add(at);
        at = p.page();
      }
      return at;
    },
    room: () => TRIM.height - MARGIN.bottom - doc.y,
    need(height) {
      if (p.room() < height) p.page();
    },
    center(text, size, face = 'body', opts = {}) {
      doc
        .font(face)
        .fontSize(size)
        .fillColor(INK)
        .text(curly(text), MARGIN.inside, doc.y, { width: MEASURE, align: 'center', ...opts });
    },
    paragraphs(text, size, face = 'body') {
      for (const para of curly(text)
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean)) {
        doc.font(face).fontSize(size).fillColor(INK).text(para, MARGIN.inside, doc.y, {
          width: MEASURE,
          align: 'justify',
          lineGap: 2,
        });
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
    halfTitle(title) {
      p.page();
      doc.y = TRIM.height * 0.32;
      p.center(title, 22, 'italic');
      blanks.add(p.page());
    },
    colophon(lines) {
      doc.y = TRIM.height - MARGIN.bottom - 24 * lines.length;
      for (const line of lines)
        doc
          .font('body')
          .fontSize(8.5)
          .fillColor(SOFT)
          .text(line, MARGIN.inside, doc.y, { width: MEASURE });
    },
    reserveContents: () => p.recto(),
    chapter(title, opts = {}) {
      chapterTitle = title;
      const first = chapters === 0;
      chapters += 1;
      if (bodyFrom < 0) bodyFrom = Number.POSITIVE_INFINITY; // heads start with this chapter
      const at = first || opts.recto ? p.recto() : p.page();
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
        p.paragraphs(opts.note, 11.5, 'italic');
        doc.moveDown(0.8);
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
      }
      const pages = doc.bufferedPageRange().count;
      doc.end();
      return { pdf: await done, pages };
    },
  };
  return p;
}
