/**
 * A keepsake of someone the family remembers: one self-contained HTML page
 * with everything they told the family and the family's memories of them.
 * It opens in any browser, prints cleanly, and needs nothing from the app.
 */
import { byMonth, type Comment, type PersonStory, spanLabel } from '@family-trivia/shared';
import { paper } from '../../../shared/design-system';

export interface KeepsakeInput {
  name: string;
  years: string | null;
  dedication?: string;
  remembering: PersonStory;
  memories: Comment[];
  nameOf: (id: string) => string;
}

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const dayName = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

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
      `<div class="m"><p>${esc(m.text)}</p><p class="by">${esc(k.nameOf(m.userId))} · ${esc(dayName(m.timestamp.slice(0, 10)))}</p></div>`,
  )
  .join('\n')}`
    : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(k.name)}, in their own words</title>
<style>
  body { margin: 0; background: ${paper.paper}; color: ${paper.ink}; font: 17px/1.6 ${paper.serif}; }
  main { max-width: 640px; margin: 0 auto; padding: 48px 24px 64px; }
  h1 { font-size: 2.4rem; margin: 0; font-weight: 700; }
  .years { color: ${paper.inkSoft}; margin: 4px 0 0; font-size: 1.1rem; }
  .ded { font-style: italic; font-size: 1.2rem; margin: 20px 0 0; }
  .span { color: ${paper.inkSoft}; margin: 20px 0 0; }
  h2 { font-size: 1.35rem; margin: 48px 0 8px; border-bottom: 1px solid ${paper.rule}; padding-bottom: 6px; }
  h3 { font-size: 1rem; font-style: italic; font-weight: 400; color: ${paper.inkSoft}; margin: 28px 0 4px; }
  .w, .m { margin: 14px 0; break-inside: avoid; }
  .q { margin: 0; color: ${paper.inkSoft}; font-size: 0.95rem; }
  .a { margin: 2px 0 0; font-size: 1.15rem; }
  .m p { margin: 0; }
  .by { color: ${paper.inkSoft}; font-size: 0.9rem; margin-top: 2px !important; }
  @media print { body { background: none; } main { padding: 0; } h2 { break-after: avoid; } }
</style></head>
<body><main>
<h1>${esc(k.name)}</h1>
${k.years ? `<p class="years">${esc(k.years)}</p>` : ''}
${k.dedication ? `<p class="ded">${esc(k.dedication)}</p>` : ''}
<p class="span">${r.words.length} answers shared${span ? `, ${esc(span)}` : ''}.</p>
${memories}
<h2>In ${esc(k.name)}’s own words</h2>
${months}
</main></body></html>
`;
}

/** Hand the keepsake to the browser as a file. */
export function saveKeepsake(k: KeepsakeInput): void {
  const blob = new Blob([keepsakeHtml(k)], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${k.name.replace(/[^\p{L}\p{N} ]/gu, '').trim() || 'keepsake'} - in their own words.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
