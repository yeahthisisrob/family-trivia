#!/usr/bin/env node
// Takes the README's pictures from Storybook stories, as listed in
// docs/screenshots/shots.json. Each entry names the story, the screen size and
// the scheme; the picture is retaken from the built Storybook, and the hash of
// the story's sources is stamped beside it so `just check` knows when a
// pictured screen has changed since its picture was taken.
//
//   just screenshots             retake every picture
//   just screenshots family-map  retake the ones whose file starts with that
//
// Needs a built Storybook (the recipe builds it) and Playwright's Chromium.

import { createReadStream, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { MANIFEST, OUT_DIR, SIZES, sourceHash } from './screenshots-lib.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const STORYBOOK_DIR = join(ROOT, 'frontend/storybook-static');
const PORT = 6007;
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

/** A phone picture is cropped to what the story drew, with a little room around it. */
async function fitted(page) {
  const box = await page.evaluate(() => {
    // dialogs render outside the story's root, so measure the whole page
    let bottom = 0;
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && getComputedStyle(el).visibility !== 'hidden')
        bottom = Math.max(bottom, r.bottom);
    }
    return {
      width: window.innerWidth,
      height: Math.min(window.innerHeight, Math.ceil(bottom) + 16),
    };
  });
  return { x: 0, y: 0, ...box };
}

const only = process.argv[2];
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const index = JSON.parse(readFileSync(join(STORYBOOK_DIR, 'index.json'), 'utf8')).entries;
const shots = manifest.shots.filter((s) => !only || s.file.startsWith(only));
for (const s of shots) if (!index[s.story]) throw new Error(`${s.file}: no story "${s.story}"`);

mkdirSync(OUT_DIR, { recursive: true });
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

server.listen(PORT, async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const shot of shots) {
    const size = SIZES[shot.size ?? 'desktop'];
    const context = await browser.newContext({
      viewport: { width: size.width, height: shot.height ?? size.height },
      deviceScaleFactor: size.scale,
      colorScheme: shot.scheme ?? 'light',
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const globals = `scheme:${shot.scheme ?? 'light'};theme:${shot.theme ?? 'classic'}`;
    try {
      await page.goto(
        `http://localhost:${PORT}/iframe.html?id=${shot.story}&viewMode=story&globals=${globals}`,
        { waitUntil: 'networkidle', timeout: 30_000 },
      );
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(shot.wait ?? 1500);
      const out = join(OUT_DIR, shot.file);
      if (shot.selector) await page.locator(shot.selector).first().screenshot({ path: out });
      else if (shot.size === 'phone')
        await page.screenshot({ path: out, clip: await fitted(page) });
      else await page.screenshot({ path: out });
      shot.storyFile = index[shot.story].importPath.replace(/^\.\//, 'frontend/');
      shot.source = sourceHash(shot.storyFile);
      console.log(`✓ ${shot.file}`);
    } catch (err) {
      failed++;
      console.error(`✗ ${shot.file}: ${err.message}`);
    }
    await context.close();
  }
  await browser.close();
  server.close();
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  process.exit(failed ? 1 : 0);
});
