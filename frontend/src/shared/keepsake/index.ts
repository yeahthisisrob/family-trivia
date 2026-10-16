/**
 * Keepsake pages: one self-contained HTML file on paper and ink that opens in
 * any browser, prints cleanly, and needs nothing from the app. A Remembering
 * page and a season's book are both saved this way.
 */
import { paper } from '../design-system';

export const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );

export const monthName = (ym: string) =>
  new Date(`${ym.slice(0, 7)}-15T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

export const dayName = (d: string) =>
  new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

/** A whole page around `body` (already escaped HTML). */
export function paperPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { margin: 0; background: ${paper.paper}; color: ${paper.ink}; font: 17px/1.6 ${paper.serif}; }
  main { max-width: 640px; margin: 0 auto; padding: 48px 24px 64px; }
  h1 { font-size: 2.4rem; margin: 0; font-weight: 700; }
  .years, .sub { color: ${paper.inkSoft}; margin: 4px 0 0; font-size: 1.1rem; }
  .ded { font-style: italic; font-size: 1.2rem; margin: 20px 0 0; }
  .span { color: ${paper.inkSoft}; margin: 20px 0 0; }
  h2 { font-size: 1.35rem; margin: 48px 0 8px; border-bottom: 1px solid ${paper.rule}; padding-bottom: 6px; break-after: avoid; }
  h3 { font-size: 1rem; font-style: italic; font-weight: 400; color: ${paper.inkSoft}; margin: 28px 0 4px; }
  .w, .m, .p { margin: 14px 0; break-inside: avoid; }
  .q { margin: 0; color: ${paper.inkSoft}; font-size: 0.95rem; }
  .a { margin: 2px 0 0; font-size: 1.15rem; }
  .p .q { color: ${paper.ink}; font-size: 1.1rem; font-weight: 700; }
  .p .a { font-size: 1.05rem; }
  .who { color: ${paper.inkSoft}; }
  .m p { margin: 0; }
  .by { color: ${paper.inkSoft}; font-size: 0.9rem; margin-top: 2px !important; }
  @media print { body { background: none; } main { padding: 0; } }
</style></head>
<body><main>
${body}
</main></body></html>
`;
}

/** Hand a keepsake to the browser as a file. */
export function saveHtml(filename: string, html: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename.replace(/[^\p{L}\p{N} -]/gu, '').trim() || 'keepsake'}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
