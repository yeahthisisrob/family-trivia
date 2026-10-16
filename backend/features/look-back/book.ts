/**
 * A season as a printed book: a 6 × 9 inch interior PDF that a print-on-demand
 * press takes as it is. EB Garamond (OFL, fonts/) is embedded; margins are
 * wide enough for any binding.
 *
 *   i    half title          v    in memory of (when the season has someone to remember)
 *   iii  title page          vii  contents
 *   iv   colophon            then a chapter per month, each opening on a
 *                            right-hand page, and the people in this book.
 *
 * Running heads carry the book's title on the left and the month on the
 * right; page numbers sit at the foot. Chapter openers and front matter have
 * neither, as in any book.
 */
import path from 'node:path';
import type { BookWriting, SeasonReview } from '@family-trivia/shared';
import PDFDocument from 'pdfkit';

const INCH = 72;
export const TRIM = { width: 6 * INCH, height: 9 * INCH };
const MARGIN = { top: 0.85 * INCH, bottom: 0.9 * INCH, inside: 0.8 * INCH, outside: 0.8 * INCH };
const MEASURE = TRIM.width - MARGIN.inside - MARGIN.outside;
/** The column the names sit in, beside the answers. */
const NAME_COL = 0.95 * INCH;

const FONTS = process.env.BOOK_FONTS_DIR ?? path.join(__dirname, 'fonts');
const font = (f: string) => path.join(FONTS, `EBGaramond-${f}.ttf`);

const INK = '#1d1a16';
const SOFT = '#5a5148';

export interface BookPerson {
  id: string;
  name: string;
  /** "1946 – 2026", for the dedication. */
  years?: string | null;
  remembered?: boolean;
}

export interface BookInput {
  review: SeasonReview;
  familyName: string;
  people: Record<string, BookPerson>;
  /** For the colophon. */
  madeOn: Date;
  /** The foreword and chapter openings, when the book has them. */
  writing?: BookWriting | null;
}

const CHAPTER_WORDS = [
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
];

/** Printers' quotes and apostrophes: “like this” and don’t. */
export const curly = (s: string) =>
  s
    .replace(/(^|[\s([{“])"/g, '$1“')
    .replace(/"/g, '”')
    .replace(/(^|[\s([{“])'/g, '$1‘')
    .replace(/'/g, '’');

const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
const dayName = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

/** The book's pages as a PDF, and how many there are. */
export function seasonBook(input: BookInput): Promise<{ pdf: Buffer; pages: number }> {
  const { review, familyName, people } = input;
  const title = review.season.name;
  const nameOf = (id: string) => people[id]?.name ?? id;

  const doc = new PDFDocument({
    size: [TRIM.width, TRIM.height],
    margins: { top: MARGIN.top, bottom: MARGIN.bottom, left: MARGIN.inside, right: MARGIN.outside },
    font: font('Regular'),
    bufferPages: true,
    autoFirstPage: false,
    info: { Title: `${title}, ${familyName}`, Author: familyName, Creator: 'Family Trivia' },
  });
  doc.registerFont('body', font('Regular'));
  doc.registerFont('italic', font('Italic'));
  doc.registerFont('bold', font('SemiBold'));

  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) =>
    doc.on('end', () => resolve(Buffer.concat(chunks))),
  );

  // Every body page gets a running head and a number, filled in once every
  // page exists; a chapter's first page gets only its number.
  const heads: { page: number; right: string }[] = [];
  const openers = new Set<number>();
  let chapterTitle = '';
  let bodyFrom = 0;
  let inBody = false;
  doc.on('pageAdded', () => {
    doc.x = MARGIN.inside;
    if (inBody) heads.push({ page: doc.bufferedPageRange().count - 1, right: chapterTitle });
  });

  const page = () => {
    doc.addPage();
    doc.x = MARGIN.inside;
    doc.y = MARGIN.top;
    return doc.bufferedPageRange().count - 1;
  };
  /** The next right-hand page (odd page number), leaving a blank behind if needed. */
  const blanks = new Set<number>();
  const recto = () => {
    let at = page();
    if (at % 2 === 1) {
      blanks.add(at);
      at = page();
    }
    return at;
  };
  const center = (
    text: string,
    size: number,
    face = 'body',
    opts: PDFKit.Mixins.TextOptions = {},
  ) =>
    doc
      .font(face)
      .fontSize(size)
      .fillColor(INK)
      .text(text, MARGIN.inside, doc.y, {
        width: MEASURE,
        align: 'center',
        ...opts,
      });
  const room = () => TRIM.height - MARGIN.bottom - doc.y;
  const bodyPage = () => page();
  const paragraphs = (text: string, size: number, face = 'body') => {
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
  };

  // ── Front matter ───────────────────────────────────────────────────
  page();
  doc.y = TRIM.height * 0.32;
  center(title, 22, 'italic');

  page(); // the back of the half title stays blank

  page();
  doc.y = TRIM.height * 0.24;
  center(title, 34, 'body');
  doc.moveDown(0.6);
  center(familyName, 15, 'italic', { characterSpacing: 0.3 });
  doc.moveDown(0.3);
  center('in our own words', 12, 'italic');
  doc.y = TRIM.height * 0.62;
  center(seasonSpan(review), 11, 'body', { features: ['smcp'], characterSpacing: 1 });
  doc.moveDown(0.4);
  const n = review.numbers;
  center(
    `${n.people} of us · ${n.answers.toLocaleString('en-US')} answers · ${n.days} days`,
    10,
    'italic',
  );

  page();
  doc.y = TRIM.height - MARGIN.bottom - 96;
  const colophon = [
    `© ${input.madeOn.getUTCFullYear()} ${familyName}. Every answer belongs to the person who gave it.`,
    'Gathered with Family Trivia, a game for staying close.',
    'Set in EB Garamond.',
    `Made ${input.madeOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.`,
  ];
  for (const line of colophon)
    doc
      .font('body')
      .fontSize(8.5)
      .fillColor(SOFT)
      .text(line, MARGIN.inside, doc.y, { width: MEASURE });

  const remembered = Object.values(people).filter(
    (p) => p.remembered && review.people.some((r) => r.personId === p.id),
  );
  if (remembered.length) {
    recto();
    doc.y = TRIM.height * 0.3;
    center('In memory of', 13, 'italic');
    doc.moveDown(1);
    for (const p of remembered) {
      center(p.name, 18, 'body');
      if (p.years) center(p.years, 11, 'italic', { characterSpacing: 0.5 });
      doc.moveDown(0.8);
    }
  }

  // Contents, written once the chapters know their pages.
  const contentsPage = recto();
  const months = groupByMonth(review);
  const startsAt: number[] = [];
  const writing = input.writing;

  if (writing?.foreword.trim()) {
    recto();
    doc.y = TRIM.height * 0.18;
    center('Foreword', 18, 'body');
    doc.moveDown(1.5);
    paragraphs(writing.foreword, 11.5);
  }

  // ── Chapters ───────────────────────────────────────────────────────
  months.forEach((m, i) => {
    chapterTitle = monthName(m.month);
    // The first chapter opens on a right-hand page; the rest on the next page.
    inBody = true;
    const opener = i === 0 ? recto() : page();
    if (!bodyFrom) bodyFrom = opener;
    if (i === 0 && !heads.some((h) => h.page === opener))
      heads.push({ page: opener, right: chapterTitle });
    openers.add(opener);
    startsAt.push(opener);
    doc.y = TRIM.height * 0.22;
    center(`Chapter ${CHAPTER_WORDS[i] ?? i + 1}`, 10, 'body', {
      features: ['smcp'],
      characterSpacing: 2,
    });
    doc.moveDown(0.5);
    center(chapterTitle, 26, 'body');
    doc.moveDown(0.4);
    rule();
    doc.moveDown(1.5);
    const note = writing?.chapters[m.month]?.trim();
    if (note) {
      paragraphs(note, 11.5, 'italic');
      doc.moveDown(0.8);
    } else doc.moveDown(0.5);

    for (const p of m.pages) {
      // Keep a question with at least its first answer.
      const first = p.answers[0];
      const need =
        doc.font('bold').fontSize(12.5).heightOfString(p.question, { width: MEASURE }) +
        30 +
        (first ? answerHeight(nameOf(first.personId), first.answer) : 0);
      if (room() < need) bodyPage();

      doc.font('bold').fontSize(12.5).fillColor(INK).text(curly(p.question), MARGIN.inside, doc.y, {
        width: MEASURE,
      });
      doc.font('italic').fontSize(9.5).fillColor(SOFT).text(dayName(p.date), { width: MEASURE });
      doc.moveDown(0.5);
      for (const a of p.answers) {
        const name = nameOf(a.personId);
        if (room() < Math.min(answerHeight(name, a.answer), 60)) bodyPage();
        answer(name, a.answer);
      }
      doc.moveDown(1.1);
    }
  });

  // ── The people in this book ────────────────────────────────────────
  chapterTitle = 'The people in this book';
  const back = recto();
  openers.add(back);
  doc.y = TRIM.height * 0.22;
  center(chapterTitle, 20, 'body');
  doc.moveDown(0.4);
  rule();
  doc.moveDown(1.5);
  for (const p of review.people) {
    if (room() < 32) bodyPage();
    const who = people[p.personId];
    doc.font('body').fontSize(12).fillColor(INK).text(nameOf(p.personId), MARGIN.inside, doc.y, {
      continued: !!who?.years,
    });
    if (who?.years) doc.font('italic').fontSize(10).fillColor(SOFT).text(`  ${who.years}`);
    doc
      .font('italic')
      .fontSize(9.5)
      .fillColor(SOFT)
      .text(
        [
          p.answers ? `${p.answers} ${p.answers === 1 ? 'answer' : 'answers'}` : null,
          p.trivia ? `${p.trivia} trivia questions` : null,
        ]
          .filter(Boolean)
          .join(', '),
      );
    doc.moveDown(0.5);
  }

  // An even number of pages: a book always ends on a left-hand page.
  if (doc.bufferedPageRange().count % 2 === 1) blanks.add(page());

  // ── Contents ───────────────────────────────────────────────────────
  doc.switchToPage(contentsPage);
  doc.y = TRIM.height * 0.18;
  center('Contents', 18, 'body');
  doc.moveDown(1.5);
  const folioOf = (physical: number) => physical - bodyFrom + 1;
  const entries = [
    ...months.map((m, i) => ({ label: monthName(m.month), at: startsAt[i] ?? 0 })),
    { label: 'The people in this book', at: back },
  ];
  for (const e of entries) {
    const y = doc.y;
    doc
      .font('body')
      .fontSize(12)
      .fillColor(INK)
      .text(e.label, MARGIN.inside, y, { width: MEASURE - 40 });
    doc.text(String(folioOf(e.at)), MARGIN.inside, y, { width: MEASURE, align: 'right' });
    doc.moveDown(0.6);
  }

  // ── Running heads and page numbers ─────────────────────────────────
  inBody = false;
  for (const h of heads) {
    if (h.page < bodyFrom || blanks.has(h.page)) continue;
    doc.switchToPage(h.page);
    const left = h.page % 2 === 1; // page index 1 is page 2, a left-hand page
    const head = openers.has(h.page) ? '' : left ? title : h.right;
    if (head)
      doc
        .font('italic')
        .fontSize(9)
        .fillColor(SOFT)
        .text(head, MARGIN.inside, MARGIN.top - 30, {
          width: MEASURE,
          align: 'center',
          lineBreak: false,
        });
    doc
      .font('body')
      .fontSize(9.5)
      .fillColor(SOFT)
      .text(String(folioOf(h.page)), MARGIN.inside, TRIM.height - MARGIN.bottom + 24, {
        width: MEASURE,
        align: 'center',
        lineBreak: false,
      });
  }

  const pages = doc.bufferedPageRange().count;
  doc.end();
  return done.then((pdf) => ({ pdf, pages }));

  function rule() {
    const y = doc.y + 4;
    doc
      .moveTo(TRIM.width / 2 - 24, y)
      .lineTo(TRIM.width / 2 + 24, y)
      .lineWidth(0.6)
      .strokeColor(SOFT)
      .stroke();
    doc.y = y + 4;
  }
  function answerHeight(name: string, text: string) {
    const nameH = doc
      .font('body')
      .fontSize(9.5)
      .heightOfString(name, { width: NAME_COL - 8 });
    const textH = doc
      .font('body')
      .fontSize(11.5)
      .heightOfString(text, { width: MEASURE - NAME_COL });
    return Math.max(nameH, textH) + 6;
  }
  /** A name in small caps on the left, the answer beside it, as a script is set. */
  function answer(name: string, text: string) {
    const y = doc.y;
    doc
      .font('body')
      .fontSize(9.5)
      .fillColor(SOFT)
      .text(name, MARGIN.inside, y + 1.5, {
        width: NAME_COL - 8,
        features: ['smcp'],
        characterSpacing: 0.5,
      });
    const nameEnd = doc.y;
    doc
      .font('body')
      .fontSize(11.5)
      .fillColor(INK)
      .text(curly(text), MARGIN.inside + NAME_COL, y, {
        width: MEASURE - NAME_COL,
        lineGap: 1,
      });
    // A long answer may have turned the page; otherwise go below the taller column.
    if (doc.y >= y) doc.y = Math.max(doc.y, nameEnd);
    doc.moveDown(0.45);
  }
}

function seasonSpan(review: SeasonReview) {
  const first = review.book[0]?.date ?? review.season.startDate;
  const last = review.book.at(-1)?.date ?? review.season.endDate ?? first;
  const [from, to] = [monthName(first.slice(0, 7)), monthName(last.slice(0, 7))];
  return from === to ? from : `${from} to ${to}`;
}

function groupByMonth(review: SeasonReview) {
  const out: { month: string; pages: SeasonReview['book'] }[] = [];
  for (const p of review.book) {
    const month = p.date.slice(0, 7);
    const last = out.at(-1);
    if (last?.month === month) last.pages.push(p);
    else out.push({ month, pages: [p] });
  }
  return out;
}
