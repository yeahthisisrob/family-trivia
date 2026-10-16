/**
 * A keepsake of someone the family remembers: everything they told the
 * family and the family's memories of them, as one page (shared/keepsake).
 */
import { byMonth, type Comment, type PersonStory, spanLabel } from '@family-trivia/shared';
import { dayName, esc, monthName, paperPage, saveHtml } from '../../../shared/keepsake';

export interface KeepsakeInput {
  name: string;
  years: string | null;
  dedication?: string;
  remembering: PersonStory;
  memories: Comment[];
  nameOf: (id: string) => string;
}

export function keepsakeHtml(k: KeepsakeInput): string {
  const { remembering: r } = k;
  const span = spanLabel(r.span);
  const months = byMonth(r.words)
    .map(
      (m) => `<h3>${esc(monthName(m.month))}</h3>
${m.words
  .map(
    (w) =>
      `<div class="w"><p class="q">${esc(w.question)}</p><p class="a">“${esc(w.answer)}”</p></div>`,
  )
  .join('\n')}`,
    )
    .join('\n');
  const memories = k.memories.length
    ? `<h2>Memories from the family</h2>
${k.memories
  .map(
    (m) =>
      `<div class="m"><p>${esc(m.text)}</p><p class="by">${esc(k.nameOf(m.userId))} · ${esc(dayName(m.timestamp))}</p></div>`,
  )
  .join('\n')}`
    : '';

  return paperPage(
    `${k.name}, in their own words`,
    `<h1>${esc(k.name)}</h1>
${k.years ? `<p class="years">${esc(k.years)}</p>` : ''}
${k.dedication ? `<p class="ded">${esc(k.dedication)}</p>` : ''}
<p class="span">${r.words.length} answers shared${span ? `, ${esc(span)}` : ''}.</p>
${memories}
<h2>In ${esc(k.name)}’s own words</h2>
${months}`,
  );
}

export function saveKeepsake(k: KeepsakeInput): void {
  saveHtml(`${k.name} - in their own words`, keepsakeHtml(k));
}
