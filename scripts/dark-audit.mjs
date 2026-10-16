#!/usr/bin/env node

// Dark mode audit: renders every Storybook story in the dark scheme and
// reports large elements that still paint a light background (a hardcoded
// '#fff', a white gradient). Fails when it finds any, so dark mode can't
// quietly regress.
//
// Prereq: `pnpm --filter @family-trivia/web run build-storybook`
// Run:    node scripts/dark-audit.mjs [--filter text] [--json out.json]
//
// Game boards that are deliberately light (a crossword grid, a curling sheet)
// opt out with data-light-surface on their root element.

import { createReadStream, readFileSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const DIR = join(ROOT, 'frontend/storybook-static');

const args = process.argv.slice(2);
const filter = args.includes('--filter') ? args[args.indexOf('--filter') + 1] : '';
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'));
const stories = Object.values(index.entries).filter(
  (e) => e.type === 'story' && e.id.includes(filter),
);

const server = http.createServer((req, res) => {
  const p = join(DIR, req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]);
  try {
    statSync(p);
    res.setHeader('Content-Type', MIME[extname(p)] ?? 'application/octet-stream');
    createReadStream(p).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});

// Any free port, so parallel runs (or other servers) don't collide.
server.listen(0, async () => {
  const PORT = server.address().port;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 420, height: 820 },
    colorScheme: 'dark',
  });
  const findings = [];
  // Several pages at once: the audit is IO-bound, and one at a time took ~8 minutes in CI.
  const queue = [...stories];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const page = await ctx.newPage();
      try {
        await page.goto(
          `http://localhost:${PORT}/iframe.html?id=${s.id}&viewMode=story&globals=scheme:dark`,
          {
            waitUntil: 'networkidle',
            timeout: 15000,
          },
        );
        await page.waitForTimeout(400);
        const hits = await page.evaluate(() => {
          const vw = window.innerWidth * window.innerHeight;
          const lum = (c) => {
            const m = c.match(/rgba?\(([^)]+)\)/);
            if (!m) return null;
            const [r, g, b, a = 1] = m[1]
              .split(/[ ,/]+/)
              .filter(Boolean)
              .map(Number);
            if (a < 0.6) return null;
            const f = (v) => {
              v /= 255;
              return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
          };
          const out = [];
          for (const el of document.querySelectorAll('#storybook-root *')) {
            if (el.closest('[data-light-surface]')) continue;
            // A click ripple or focus highlight caught mid-fade is not a surface.
            if (el.closest('.MuiTouchRipple-root, .MuiCardActionArea-focusHighlight')) continue;
            const r = el.getBoundingClientRect();
            const area = r.width * r.height;
            if (area < vw * 0.02 || r.width < 60) continue;
            const st = getComputedStyle(el);
            if (Number(st.opacity) === 0 || st.visibility === 'hidden') continue;
            const bg = st.backgroundColor;
            const img = st.backgroundImage;
            let light = (lum(bg) ?? 0) > 0.75;
            if (!light && img && img !== 'none') {
              const stops = [...img.matchAll(/rgba?\([^)]+\)/g)].map((m) => lum(m[0]) ?? 0);
              light = stops.length > 0 && stops.every((l) => l > 0.75);
            }
            if (light) {
              const cls = [...el.classList]
                .filter((c) => c.startsWith('Mui'))
                .slice(0, 2)
                .join('.');
              out.push({
                tag: el.tagName.toLowerCase(),
                cls,
                bg: bg !== 'rgba(0, 0, 0, 0)' ? bg : img.slice(0, 60),
                text: (el.textContent || '').trim().slice(0, 40),
              });
            }
          }
          // Report the outermost light element per branch only.
          return out.slice(0, 5);
        });
        if (hits.length) findings.push({ id: s.id, title: `${s.title} › ${s.name}`, hits });
      } catch (err) {
        findings.push({
          id: s.id,
          title: `${s.title} › ${s.name}`,
          error: String(err.message).slice(0, 80),
        });
      }
      await page.close();
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.AUDIT_CONCURRENCY ?? 6) }, worker));
  await browser.close();
  server.close();
  const bad = findings.filter((f) => f.hits);
  for (const f of bad) {
    process.stdout.write(`\n${f.title}\n`);
    for (const h of f.hits)
      process.stdout.write(`   ${h.tag}${h.cls ? `.${h.cls}` : ''}  ${h.bg}  "${h.text}"\n`);
  }
  if (jsonOut) writeFileSync(jsonOut, JSON.stringify(findings, null, 2));
  process.stdout.write(
    `\nDark audit: ${bad.length} of ${stories.length} stories paint light backgrounds in dark mode.\n`,
  );
  process.exit(bad.length ? 1 : 0);
});
