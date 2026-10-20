#!/usr/bin/env node
/**
 * The games' server folders (docs/decisions/0032), found by pattern: every
 * backend/features/games/<id>/index.ts. The Lambda is bundled by esbuild,
 * which has no import.meta.glob, so this writes the one file that imports
 * them all, backend/features/games/folders.generated.ts. Adding a folder and
 * running `just contract` is all a game needs; `just layout` fails while the
 * file is stale.
 *
 *   node scripts/game-folders.mjs           write the file
 *   node scripts/game-folders.mjs --check   exit 1 if it is stale
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = join(resolve(import.meta.dirname, '..'), 'backend', 'features', 'games');
const GENERATED = join(dir, 'folders.generated.ts');

const camel = (id) => id.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

/** The file as it should be, from the folders on disk. */
function expectedFolders() {
  const ids = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'index.ts')))
    .map((e) => e.name)
    .sort();
  return [
    '// Written by scripts/game-folders.mjs from the folders beside it (`just contract`).',
    '// Do not edit: add a folder with an index.ts instead (docs/decisions/0032).',
    ...ids.map((id) => `export { default as ${camel(id)} } from './${id}';`),
    '',
  ].join('\n');
}

export const gameFoldersCurrent = () =>
  existsSync(GENERATED) && readFileSync(GENERATED, 'utf8') === expectedFolders();

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--check')) {
    if (!gameFoldersCurrent()) {
      console.error(
        'backend/features/games/folders.generated.ts is stale: run `just contract` and commit it.',
      );
      process.exit(1);
    }
  } else {
    writeFileSync(GENERATED, expectedFolders());
    console.log('Wrote backend/features/games/folders.generated.ts');
  }
}
