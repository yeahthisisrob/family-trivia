/**
 * A season as a printed book, set on the press (services/press/press.ts).
 *
 *   title page · in memory of (when the season has
 *   someone to remember) · contents · foreword · chapters by theme, each
 *   opened by a few paragraphs telling its story (a chapter a month when the
 *   book is just our words) · the people in this book
 *
 * Every day's question is printed with everyone's answers, names in small
 * caps in their own column, as a script is set.
 */
import { type BookPage, type BookWriting, pageKey, type SeasonReview } from '@family-trivia/shared';
import {
  curly,
  dayName,
  fitted,
  INK,
  type Laid,
  MARGIN,
  monthName,
  numberWord,
  press,
  SOFT,
} from '../../services/press/press';

/** The column the names sit in, beside the answers. */
const NAME_COL = 0.95 * 72;

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
  /** The foreword and chapter openings, when the book has them. */
  writing?: BookWriting | null;
}

export { curly };

/** The book's pages as a PDF, and how many there are. */
/** The book at the size that leaves the fewest near-empty pages. */
export const seasonBook = (input: BookInput): Promise<Laid> =>
  fitted((scale) => layOut(input, scale));

async function layOut(input: BookInput, scale: number): Promise<Laid> {
  const { review, familyName, people, writing } = input;
  const title = review.season.name;
  const nameOf = (id: string) => people[id]?.name ?? id;
  const p = press({ title, author: familyName, scale });
  const { doc } = p;

  p.page();
  doc.y = p.trim.height * 0.24;
  p.center(title, 34);
  doc.moveDown(0.6);
  p.center(familyName, 15, 'italic', { characterSpacing: 0.3 });
  doc.moveDown(0.3);
  p.center('in our own words', 12, 'italic');
  doc.y = p.trim.height * 0.62;
  p.center(seasonSpan(review), 11, 'body', { features: ['smcp'], characterSpacing: 1 });
  doc.moveDown(0.4);
  const n = review.numbers;
  p.center(
    `${n.people} of us · ${n.answers.toLocaleString('en-US')} answers · ${n.days} days`,
    10,
    'italic',
  );

  const remembered = Object.values(people).filter(
    (x) => x.remembered && review.people.some((r) => r.personId === x.id),
  );
  if (remembered.length) {
    p.page();
    doc.y = p.trim.height * 0.3;
    p.center('In memory of', 13, 'italic');
    doc.moveDown(1);
    for (const x of remembered) {
      p.center(x.name, 18);
      if (x.years) p.center(x.years, 11, 'italic', { characterSpacing: 0.5 });
      doc.moveDown(0.8);
    }
  }

  const contents = p.reserveContents();

  if (writing?.foreword.trim()) {
    p.page();
    doc.y = p.trim.height * 0.18;
    p.center('Foreword', 18);
    doc.moveDown(1.5);
    p.paragraphs(writing.foreword, 11.5);
  }

  // Chapters by theme when the book was written that way, else a chapter a month.
  const byKey = new Map(review.book.map((d) => [pageKey(d), d]));
  const chapters = writing?.plan?.length
    ? writing.plan.map((c) => ({
        title: c.title,
        note: c.intro ?? undefined,
        noteFace: 'body' as const,
        pages: c.pages.map((k) => byKey.get(k)).filter((d): d is BookPage => !!d),
      }))
    : groupByMonth(review).map((m) => ({
        title: monthName(m.month),
        note: writing?.chapters[m.month],
        noteFace: 'italic' as const,
        pages: m.pages,
      }));
  const entries: { label: string; at: number }[] = [];
  chapters.forEach((c, i) => {
    entries.push({
      label: c.title,
      at: p.chapter(c.title, {
        kicker: `Chapter ${numberWord(i + 1)}`,
        note: c.note,
        noteFace: c.noteFace,
      }),
    });
    for (const page of c.pages) {
      // Keep a question with at least its first answer.
      const first = page.answers[0];
      p.need(
        doc.font('bold').fontSize(12.5).heightOfString(page.question, { width: p.measure }) +
          30 +
          (first ? answerHeight(nameOf(first.personId), first.answer) : 0),
      );
      doc
        .font('bold')
        .fontSize(12.5)
        .fillColor(INK)
        .text(curly(page.question), MARGIN.inside, doc.y, { width: p.measure });
      doc
        .font('italic')
        .fontSize(9.5)
        .fillColor(SOFT)
        .text(dayName(page.date, true), { width: p.measure });
      doc.moveDown(0.5);
      for (const a of page.answers) {
        const name = nameOf(a.personId);
        p.need(Math.min(answerHeight(name, a.answer), 60));
        answer(name, a.answer);
      }
      doc.moveDown(1.1);
    }
  });

  const peopleTitle = 'The people in this book';
  entries.push({ label: peopleTitle, at: p.chapter(peopleTitle) });
  for (const r of review.people) {
    p.need(32);
    const who = people[r.personId];
    doc
      .font('body')
      .fontSize(12)
      .fillColor(INK)
      .text(nameOf(r.personId), MARGIN.inside, doc.y, { continued: !!who?.years });
    if (who?.years) doc.font('italic').fontSize(10).fillColor(SOFT).text(`  ${who.years}`);
    doc
      .font('italic')
      .fontSize(9.5)
      .fillColor(SOFT)
      .text(
        [
          r.answers ? `${r.answers} ${r.answers === 1 ? 'answer' : 'answers'}` : null,
          r.trivia ? `${r.trivia} trivia questions` : null,
        ]
          .filter(Boolean)
          .join(', '),
      );
    doc.moveDown(0.5);
  }

  p.contents(contents, entries);
  return p.finish();

  function answerHeight(name: string, text: string) {
    const nameH = doc
      .font('body')
      .fontSize(9.5)
      .heightOfString(name, { width: NAME_COL - 8 });
    const textH = doc
      .font('body')
      .fontSize(11.5)
      .heightOfString(text, { width: p.measure - NAME_COL });
    return Math.max(nameH, textH) + 6;
  }
  /** A name in small caps on the left, the answer beside it. */
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
    doc.fontSize(11.5).fillColor(INK);
    p.say(curly(text), 'body', MARGIN.inside + NAME_COL, y, {
      width: p.measure - NAME_COL,
      lineGap: 1,
    });
    // A long answer may have turned the page; otherwise go below the taller column.
    if (doc.y >= y) doc.y = Math.max(doc.y, nameEnd);
    doc.moveDown(0.45);
  }
}

/** The months the season's questions ran, from the first day asked to the last. */
export function seasonSpan(review: SeasonReview) {
  const first = review.book[0]?.date ?? review.season.startDate;
  const last = review.book.at(-1)?.date ?? review.season.endDate ?? first;
  const [from, to] = [monthName(first), monthName(last)];
  return from === to ? from : `${from} to ${to}`;
}

function groupByMonth(review: SeasonReview) {
  const out: { month: string; pages: SeasonReview['book'] }[] = [];
  for (const page of review.book) {
    const month = page.date.slice(0, 7);
    const last = out.at(-1);
    if (last?.month === month) last.pages.push(page);
    else out.push({ month, pages: [page] });
  }
  return out;
}
