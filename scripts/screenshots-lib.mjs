// What the scripts that photograph stories share: where the README's pictures
// live, the screen sizes, how a pictured story's sources are fingerprinted,
// and the built Storybook over HTTP.

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
export const OUT_DIR = join(ROOT, 'docs/screenshots');
export const MANIFEST = join(OUT_DIR, 'shots.json');
export const README = join(ROOT, 'README.md');
export const TOUR = join(ROOT, 'docs/tour.md');
export const STORYBOOK_DIR = join(ROOT, 'frontend/storybook-static');

/** A laptop screen at 1.5x, and a phone at 2x. */
export const SIZES = {
  desktop: { width: 1440, height: 900, scale: 1.5 },
  phone: { width: 390, height: 844, scale: 2 },
};

/**
 * The story file and the component it pictures (same name without
 * `.stories`), hashed: when either changes, the picture may be out of date.
 */
export function sourceHash(storyPath) {
  const story = join(ROOT, storyPath);
  if (!existsSync(story)) throw new Error(`no story file ${storyPath}`);
  const component = story.replace('.stories.tsx', '.tsx');
  const hash = createHash('sha256');
  for (const f of [story, component]) if (existsSync(f)) hash.update(readFileSync(f));
  return hash.digest('hex').slice(0, 12);
}

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

/** The built Storybook over HTTP, for a script that photographs its stories. */
export function storybookServer() {
  return http.createServer((req, res) => {
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
}
