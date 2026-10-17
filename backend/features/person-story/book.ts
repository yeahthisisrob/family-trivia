/**
 * One person in their own words, as a printed book (services/press/press.ts):
 *
 *   title page (name, years, the family's dedication) · for someone the
 *   family has lost, the last things they told
 *   us and the family's memories of them · what the family said about them,
 *   and what we wrote back under their answers · then a chapter a year,
 *   every answer under the question it answered, month by month.
 */
import { type Comment, LAST_WORDS, type PersonStory, type StoryWord } from '@family-trivia/shared';
import {
  curly,
  dayName,
  fitted,
  INK,
  type Laid,
  MARGIN,
  monthName,
  press,
  SOFT,
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
}

/** The book at the size that leaves the fewest near-empty pages. */
export const personBook = (b: PersonBookInput): Promise<Laid> =>
  fitted((scale) => layOut(b, scale));

async function layOut(b: PersonBookInput, scale: number): Promise<Laid> {
  const p = press({ title: b.name, author: b.familyName, scale });
  const { doc } = p;
  const byId = new Map(b.story.words.map((w) => [w.id, w]));

  p.page();
  doc.y = p.trim.height * 0.24;
  p.center(b.name, 34);
  if (b.years) {
    doc.moveDown(0.4);
    p.center(b.years, 13, 'italic', { characterSpacing: 0.5 });
  }
  if (b.dedication) {
    doc.moveDown(1.2);
    p.center(b.dedication, 13, 'italic');
  }
  doc.y = p.trim.height * 0.66;
  p.center(`in ${b.name}’s own words`, 12, 'italic');
  doc.moveDown(0.3);
  p.center(b.familyName, 11, 'body', { features: ['smcp'], characterSpacing: 1 });

  if (b.remembered && b.story.last.length) {
    const title = `The last things ${b.name} told us`;
    p.chapter(title);
    for (const id of b.story.last.slice(0, LAST_WORDS)) {
      const w = byId.get(id);
      if (w) said(w, true);
    }
  }

  if (b.memories.length) {
    const title = `Memories of ${b.name}`;
    p.chapter(title);
    for (const m of b.memories) {
      p.need(doc.font('body').fontSize(12).heightOfString(m.text, { width: p.measure }) + 30);
      p.paragraphs(m.text, 12);
      doc
        .font('body')
        .fontSize(9.5)
        .fillColor(SOFT)
        .text(b.nameOf[m.userId] ?? m.userId, MARGIN.inside, doc.y - 6, {
          width: p.measure,
          align: 'right',
          features: ['smcp'],
          characterSpacing: 0.5,
        });
      doc.moveDown(1.2);
    }
  }

  const mentions = b.story.mentions ?? [];
  if (mentions.length) {
    const title = `What the family said about ${b.name}`;
    p.chapter(title);
    for (const m of mentions) {
      // The name stays on the page with what they said.
      p.need(20 + heightOf({ id: m.id, question: m.question, answer: m.answer, date: m.date }));
      doc
        .font('body')
        .fontSize(9.5)
        .fillColor(SOFT)
        .text(b.nameOf[m.personId] ?? m.personId, MARGIN.inside, doc.y, {
          width: p.measure,
          features: ['smcp'],
          characterSpacing: 0.5,
        });
      said({ id: m.id, question: m.question, answer: m.answer, date: m.date }, true);
    }
  }

  const replies = (b.story.replies ?? []).filter((r) => byId.has(r.on));
  if (replies.length) {
    const title = 'What we wrote back';
    p.chapter(title);
    for (const r of replies) {
      const w = byId.get(r.on);
      if (!w) continue;
      said(w, true);
      for (const c of r.comments) {
        p.need(40);
        doc
          .font('body')
          .fontSize(9.5)
          .fillColor(SOFT)
          .text(b.nameOf[c.userId] ?? c.userId, MARGIN.inside + 14, doc.y - 4, {
            width: p.measure - 14,
            features: ['smcp'],
            characterSpacing: 0.5,
          });
        doc.fontSize(11.5).fillColor(INK);
        p.say(curly(c.text), 'italic', MARGIN.inside + 14, doc.y, { width: p.measure - 14 });
        doc.moveDown(0.6);
      }
      doc.moveDown(0.6);
    }
  }

  for (const [year, words] of byYear(b.story.words)) {
    p.chapter(year, { kicker: `In ${b.name}’s own words` });
    let month = '';
    for (const w of words) {
      if (w.date.slice(0, 7) !== month) {
        month = w.date.slice(0, 7);
        // A month's name never sits alone at the foot of a page: it keeps its first answer.
        p.need(36 + heightOf(w));
        doc.moveDown(0.4);
        doc
          .font('body')
          .fontSize(10)
          .fillColor(SOFT)
          .text(monthName(month), MARGIN.inside, doc.y, {
            width: p.measure,
            features: ['smcp'],
            characterSpacing: 1.5,
          });
        doc.moveDown(0.6);
      }
      said(w, false);
    }
  }

  return p.finish();

  /** Room a question needs with the start of its answer. */
  function heightOf(w: StoryWord) {
    const qH = doc.font('italic').fontSize(10.5).heightOfString(w.question, { width: p.measure });
    const aH = doc.font('body').fontSize(13).heightOfString(w.answer, { width: p.measure });
    return qH + Math.min(aH, 90) + 24;
  }

  /** A question, then the answer in its own words. */
  function said(w: StoryWord, withDate: boolean) {
    p.need(heightOf(w));
    doc
      .font('italic')
      .fontSize(10.5)
      .fillColor(SOFT)
      .text(curly(w.question), MARGIN.inside, doc.y, { width: p.measure });
    doc.moveDown(0.2);
    doc.fontSize(13).fillColor(INK);
    p.say(curly(w.answer), 'body', MARGIN.inside, doc.y, { width: p.measure, lineGap: 1.5 });
    if (withDate)
      doc
        .font('italic')
        .fontSize(9)
        .fillColor(SOFT)
        .text(dayName(w.date, true), MARGIN.inside, doc.y + 2, { width: p.measure });
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
