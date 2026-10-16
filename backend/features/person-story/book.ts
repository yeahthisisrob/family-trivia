/**
 * One person in their own words, as a printed book (services/press/press.ts):
 *
 *   half title · title page (name, years, the family's dedication) · colophon
 *   · contents · for someone the family has lost, the last things they told
 *   us and the family's memories of them · then a chapter a year, every
 *   answer under the question it answered, month by month.
 */
import { type Comment, LAST_WORDS, type PersonStory, type StoryWord } from '@family-trivia/shared';
import {
  curly,
  dayName,
  INK,
  MARGIN,
  MEASURE,
  monthName,
  press,
  SOFT,
  TRIM,
} from '../../services/press/press';

export interface PersonBookInput {
  name: string;
  /** "1946 – 2026", for someone the family remembers. */
  years: string | null;
  dedication: string | null;
  remembered: boolean;
  familyName: string;
  story: PersonStory;
  memories: Comment[];
  nameOf: Record<string, string>;
  madeOn: Date;
}

export async function personBook(b: PersonBookInput): Promise<{ pdf: Buffer; pages: number }> {
  const p = press({ title: b.name, author: b.familyName });
  const { doc } = p;
  const byId = new Map(b.story.words.map((w) => [w.id, w]));

  p.halfTitle(b.name);

  p.page();
  doc.y = TRIM.height * 0.24;
  p.center(b.name, 34);
  if (b.years) {
    doc.moveDown(0.4);
    p.center(b.years, 13, 'italic', { characterSpacing: 0.5 });
  }
  if (b.dedication) {
    doc.moveDown(1.2);
    p.center(b.dedication, 13, 'italic');
  }
  doc.y = TRIM.height * 0.66;
  p.center(`in ${b.name}’s own words`, 12, 'italic');
  doc.moveDown(0.3);
  p.center(b.familyName, 11, 'body', { features: ['smcp'], characterSpacing: 1 });

  p.page();
  p.colophon([
    `© ${b.madeOn.getUTCFullYear()} ${b.familyName}. Every word here is ${b.name}’s, or the family’s.`,
    'Gathered with Family Trivia, a game for staying close.',
    'Set in EB Garamond.',
    `Made ${b.madeOn.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.`,
  ]);

  const contents = p.reserveContents();
  const entries: { label: string; at: number }[] = [];

  if (b.remembered && b.story.last.length) {
    const title = `The last things ${b.name} told us`;
    entries.push({ label: title, at: p.chapter(title) });
    for (const id of b.story.last.slice(0, LAST_WORDS)) {
      const w = byId.get(id);
      if (w) said(w, true);
    }
  }

  if (b.memories.length) {
    const title = `Memories of ${b.name}`;
    entries.push({ label: title, at: p.chapter(title) });
    for (const m of b.memories) {
      p.need(doc.font('body').fontSize(12).heightOfString(m.text, { width: MEASURE }) + 30);
      p.paragraphs(m.text, 12);
      doc
        .font('body')
        .fontSize(9.5)
        .fillColor(SOFT)
        .text(b.nameOf[m.userId] ?? m.userId, MARGIN.inside, doc.y - 6, {
          width: MEASURE,
          align: 'right',
          features: ['smcp'],
          characterSpacing: 0.5,
        });
      doc.moveDown(1.2);
    }
  }

  for (const [year, words] of byYear(b.story.words)) {
    entries.push({ label: year, at: p.chapter(year, { kicker: `In ${b.name}’s own words` }) });
    let month = '';
    for (const w of words) {
      if (w.date.slice(0, 7) !== month) {
        month = w.date.slice(0, 7);
        p.need(80);
        doc.moveDown(0.4);
        doc
          .font('body')
          .fontSize(10)
          .fillColor(SOFT)
          .text(monthName(month), MARGIN.inside, doc.y, {
            width: MEASURE,
            features: ['smcp'],
            characterSpacing: 1.5,
          });
        doc.moveDown(0.6);
      }
      said(w, false);
    }
  }

  p.contents(contents, entries);
  return p.finish();

  /** A question, then the answer in its own words. */
  function said(w: StoryWord, withDate: boolean) {
    const qH = doc.font('italic').fontSize(10.5).heightOfString(w.question, { width: MEASURE });
    const aH = doc.font('body').fontSize(13).heightOfString(w.answer, { width: MEASURE });
    p.need(qH + Math.min(aH, 90) + 24);
    doc
      .font('italic')
      .fontSize(10.5)
      .fillColor(SOFT)
      .text(curly(w.question), MARGIN.inside, doc.y, { width: MEASURE });
    doc.moveDown(0.2);
    doc
      .font('body')
      .fontSize(13)
      .fillColor(INK)
      .text(curly(w.answer), MARGIN.inside, doc.y, { width: MEASURE, lineGap: 1.5 });
    if (withDate)
      doc
        .font('italic')
        .fontSize(9)
        .fillColor(SOFT)
        .text(dayName(w.date, true), MARGIN.inside, doc.y + 2, { width: MEASURE });
    doc.moveDown(1);
  }
}

function byYear(words: StoryWord[]): [string, StoryWord[]][] {
  const out = new Map<string, StoryWord[]>();
  for (const w of words) {
    const y = w.date.slice(0, 4);
    out.set(y, [...(out.get(y) ?? []), w]);
  }
  return [...out];
}
