#!/usr/bin/env node
// Capture hero screenshots of curated Storybook stories for README.md.
// Prereq: `npm install` at repo root, then `cd frontend && npm run build-storybook`.
// Run: `node scripts/screenshot-stories.mjs`

import http from 'node:http';
import { createReadStream, statSync, mkdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const ROOT = resolve(import.meta.dirname, '..');
const STORYBOOK_DIR = join(ROOT, 'frontend/storybook-static');
const OUT_DIR = join(ROOT, 'docs/screenshots');
const PORT = 6007;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
  '.map': 'application/json',
};

const stories = [
  { id: 'trivia-flow-triviaflow--game-modes-available', name: '01-trivia-flow', viewport: { width: 420, height: 820 } },
  { id: 'leaderboard-podium--three-players', name: '02-leaderboard', viewport: { width: 640, height: 520 } },
  { id: 'trivia-game-modes-casinorush--start-screen', name: '03-casino-rush', viewport: { width: 420, height: 760 } },
  { id: 'trivia-game-modes-slotmachine--trivia-mode', name: '04-slot-machine', viewport: { width: 420, height: 760 } },
  { id: 'timelineboard-facttimelinecard--default', name: '05-fact-card', viewport: { width: 520, height: 420 } },
  { id: 'timelineboard-triviacomments--default', name: '06-comments', viewport: { width: 520, height: 700 } },
  { id: 'familytree-familysplitview--full-tree', name: '07-family-tree', viewport: { width: 520, height: 720 } },
  {
    id: 'notifications-notificationpanel--with-leader-change',
    name: '08-notifications',
    viewport: { width: 480, height: 700 },
    selector: '.MuiPopover-paper',
  },
];

mkdirSync(OUT_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  const path = join(STORYBOOK_DIR, url === '/' ? '/index.html' : url);
  try {
    statSync(path);
    res.setHeader('Content-Type', MIME[extname(path)] ?? 'application/octet-stream');
    createReadStream(path).pipe(res);
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
  }
});

server.listen(PORT, async () => {
  console.log(`Serving storybook-static on http://localhost:${PORT}`);
  const browser = await chromium.launch();

  for (const story of stories) {
    const context = await browser.newContext({
      viewport: story.viewport,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    const url = `http://localhost:${PORT}/iframe.html?id=${story.id}&viewMode=story`;
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(1200);
      const out = join(OUT_DIR, `${story.name}.png`);
      if (story.selector) {
        await page.locator(story.selector).first().screenshot({ path: out });
      } else {
        await page.screenshot({ path: out, fullPage: false });
      }
      console.log(`✓ ${story.name}.png  (${story.id})`);
    } catch (err) {
      console.error(`✗ ${story.name}: ${err.message}`);
    }
    await context.close();
  }

  await browser.close();
  server.close();
  process.exit(0);
});
