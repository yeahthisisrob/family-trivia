/**
 * A season's book: every day's question with everyone's answers, month by
 * month, as one keepsake page (shared/keepsake).
 */
import type { SeasonReview } from '@family-trivia/shared';
import { dayName, esc, monthName, paperPage, saveHtml } from '../../../shared/keepsake';

/** "May 2025 to July 2025", or the start alone while a season runs. */
export function seasonDates(s: SeasonReview['season']): string {
  const from = monthName(s.startDate);
  if (!s.endDate) return `Since ${from}`;
  const to = monthName(s.endDate);
  return from === to ? from : `${from} to ${to}`;
}

export function bookHtml(r: SeasonReview, familyName: string, nameOf: (id: string) => string) {
  let month = '';
  const pages = r.book
    .map((p) => {
      const m = p.date.slice(0, 7);
      const heading = m !== month ? `<h2>${esc(monthName(m))}</h2>` : '';
      month = m;
      return `${heading}
<div class="p"><p class="q">${esc(p.question)}</p><p class="by">${esc(dayName(p.date))}</p>
${p.answers.map((a) => `<p class="a"><span class="who">${esc(nameOf(a.personId))}:</span> ${esc(a.answer)}</p>`).join('\n')}
</div>`;
    })
    .join('\n');
  const n = r.numbers;
  return paperPage(
    `${r.season.name}, ${familyName}`,
    `<h1>${esc(r.season.name)}</h1>
<p class="sub">${esc(familyName)} · ${esc(seasonDates(r.season))}</p>
<p class="span">${n.people} of us, ${n.answers} answers, ${n.words.toLocaleString()} words.</p>
${pages}`,
  );
}

export function saveBook(r: SeasonReview, familyName: string, nameOf: (id: string) => string) {
  saveHtml(`${familyName} - ${r.season.name}`, bookHtml(r, familyName, nameOf));
}
