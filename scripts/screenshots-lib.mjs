// What the screenshot script and its check share: where the pictures live,
// the screen sizes, and how a pictured story's sources are fingerprinted.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
export const OUT_DIR = join(ROOT, 'docs/screenshots');
export const MANIFEST = join(OUT_DIR, 'shots.json');
export const README = join(ROOT, 'README.md');
export const TOUR = join(ROOT, 'docs/tour.md');

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
