#!/usr/bin/env node
// Keeps the README's pictures honest. Fails when:
//   - the README shows a picture that isn't in docs/screenshots/shots.json, or
//     a listed picture is missing, unused, or not in the manifest;
//   - a pictured story or its component changed since the picture was taken
//     (its sources no longer hash to the stamp `just screenshots` left);
//   - with a built Storybook beside it (CI's story job), a listed story is gone.
// The fix is always the same: `just screenshots` (or `just screenshots <file>`).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MANIFEST, OUT_DIR, README, sourceHash } from './screenshots-lib.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const { shots } = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const readme = readFileSync(README, 'utf8');
const problems = [];

const listed = new Set(shots.map((s) => s.file));
const shown = new Set([...readme.matchAll(/docs\/screenshots\/([\w-]+\.png)/g)].map((m) => m[1]));
const onDisk = new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith('.png')));

for (const f of shown)
  if (!listed.has(f)) problems.push(`README shows ${f}, which shots.json doesn't list`);
for (const f of listed) {
  if (!onDisk.has(f)) problems.push(`${f} is listed but was never taken`);
  if (!shown.has(f)) problems.push(`${f} is listed but the README doesn't show it`);
}
for (const f of onDisk)
  if (!listed.has(f)) problems.push(`${f} is in docs/screenshots but not in shots.json`);

for (const s of shots) {
  if (!s.storyFile || !existsSync(join(ROOT, s.storyFile)))
    problems.push(`${s.file}: its story file ${s.storyFile ?? '(none)'} is gone`);
  else if (sourceHash(s.storyFile) !== s.source)
    problems.push(`${s.file}: ${s.storyFile} or its component changed since the picture was taken`);
}

const index = join(ROOT, 'frontend/storybook-static/index.json');
if (process.argv.includes('--stories') && existsSync(index)) {
  const entries = JSON.parse(readFileSync(index, 'utf8')).entries;
  for (const s of shots) if (!entries[s.story]) problems.push(`${s.file}: no story "${s.story}"`);
}

if (problems.length) {
  console.error(`README screenshots are out of date:\n  ${problems.join('\n  ')}`);
  console.error('Retake them with `just screenshots` (or `just screenshots <file>`).');
  process.exit(1);
}
console.log(`README screenshots: ${shots.length} pictures, all current.`);
