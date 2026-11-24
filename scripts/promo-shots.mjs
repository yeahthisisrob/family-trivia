#!/usr/bin/env node
// Films the stills a promo video is cut from, out of the built Storybook: the real screens over the stories' made-up
// family (docs/decisions/0006), at a phone's width. Each scene opens a story and takes a still; a scene with `run`
// does what a person would do (types an answer a word at a time, sends it) and takes a still at each step, so a video
// editor can play them back as the app being used.
//
//   just promo-shots <stills dir> <manifest.json> [scene ids...]
//
// Nothing here reads a deployment: stories only.

import { createReadStream, mkdirSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const [outDir, manifestPath, ...only] = process.argv.slice(2);
if (!outDir || !manifestPath) {
  console.error('usage: node scripts/promo-shots.mjs <stills dir> <manifest.json> [scene ids...]');
  process.exit(1);
}
const STORYBOOK_DIR = resolve(import.meta.dirname, '../frontend/storybook-static');
const PORT = 6008;
const PHONE = { width: 400, height: 540 };
const TALLEST = 1500;
const SETTLE_MS = 1500;
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

const ANSWER = "Sunday dinner at Grandma's, with everyone at one long table.";

/** The scenes, in the order the promo shows them. */
const SCENES = [
  {
    id: 'question',
    story: 'home-dailyfactcard--todays-question',
    run: async ({ page, shot }) => {
      const box = page.getByPlaceholder('Type your answer...');
      await shot();
      const words = ANSWER.split(' ');
      for (let i = 1; i <= words.length; i++) {
        await box.fill(words.slice(0, i).join(' '));
        await shot({ settle: 60 });
      }
      await page.getByRole('button', { name: /Submit Answer/ }).click();
      await page.getByRole('button', { name: /Submit Answer/ }).waitFor({ state: 'detached' });
      await shot();
    },
  },
  { id: 'memory', story: 'home-dailymemory--on-this-day' },
  { id: 'spotlight', story: 'family-spotlightcard--today' },
  { id: 'home', story: 'family-familyhome--story-first' },
  { id: 'threads', story: 'home-threadcard--how-do-you-know' },
  { id: 'circles', story: 'appshell-appheader--in-several-circles' },
  {
    id: 'sky',
    story: 'family-familygraph--blended-family',
    scheme: 'dark',
    width: 620,
    height: 660,
  },
  { id: 'map', story: 'family-familymap--our-map', scheme: 'dark', height: 620 },
  { id: 'games', story: 'trivia-flow-triviaflow--game-modes-available' },
  { id: 'lookback', story: 'family-seasonlookback--a-season' },
  { id: 'book', story: 'family-bookdialog--choose-how-its-written' },
  { id: 'remembering', story: 'family-rememberingpage--remembering' },
];

/** The height of what the story drew, so a still is the screen and not the empty page under it. */
const drawnHeight = (page) =>
  page.evaluate(() => {
    let bottom = 0;
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && getComputedStyle(el).visibility !== 'hidden')
        bottom = Math.max(bottom, r.bottom + window.scrollY);
    }
    return Math.ceil(bottom);
  });

async function film(browser, scene) {
  const scheme = scene.scheme ?? 'light';
  const width = scene.width ?? PHONE.width;
  const context = await browser.newContext({
    viewport: { width, height: scene.height ?? PHONE.height },
    deviceScaleFactor: 3,
    colorScheme: scheme,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const shots = [];
  const shot = async ({ settle = SETTLE_MS } = {}) => {
    await page.waitForTimeout(settle);
    const file = `${scene.id}-${String(shots.length + 1).padStart(2, '0')}.jpg`;
    const height = Math.min(TALLEST, Math.max(await drawnHeight(page), 200));
    // a page taller than the phone is taken whole, for the editor to scroll
    await page.setViewportSize({ width, height: Math.max(height, 200) });
    await page.waitForTimeout(120);
    await page.screenshot({ path: join(outDir, file), type: 'jpeg', quality: 93 });
    shots.push({ img: file, w: width, h: Math.max(height, 200) });
    console.log(`  ${file}`);
  };
  try {
    await page.goto(
      `http://localhost:${PORT}/iframe.html?id=${scene.story}&viewMode=story&globals=scheme:${scheme};theme:classic`,
      { waitUntil: 'networkidle', timeout: 30_000 },
    );
    await page.evaluate(() => document.fonts.ready);
    if (scene.run) await scene.run({ page, shot });
    else await shot();
  } finally {
    await context.close();
  }
  return { id: scene.id, story: scene.story, scheme, shots };
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const path = join(STORYBOOK_DIR, url === '/' ? '/index.html' : url);
  try {
    statSync(path);
    res.setHeader('Content-Type', MIME[extname(path)] ?? 'application/octet-stream');
    createReadStream(path).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end();
  }
});

mkdirSync(outDir, { recursive: true });
server.listen(PORT, async () => {
  const browser = await chromium.launch();
  const scenes = [];
  try {
    for (const scene of SCENES) {
      if (only.length && !only.includes(scene.id)) continue;
      console.log(scene.id);
      scenes.push(await film(browser, scene));
    }
  } finally {
    await browser.close();
    server.close();
  }
  writeFileSync(manifestPath, `${JSON.stringify({ phone: PHONE, scenes }, null, 1)}\n`);
  console.log(`${scenes.length} scenes, ${scenes.reduce((n, s) => n + s.shots.length, 0)} stills`);
});
