#!/usr/bin/env node
/**
 * The layout rules in docs/decisions/0008, checked (Biome's import globs
 * can't say "a different slice" for relative paths):
 *
 * Backend (VSA): a slice in backend/features/<slice>/ never imports another
 * slice, and backend/services/ (what slices share) never imports a slice.
 * Slices meet through services/ registries (lifeEvents, the storage links).
 *
 * Frontend (FSD): a layer only imports layers below it
 * (pages → widgets → features → entities → shared), and another slice of
 * the same or a lower layer only through its public API (its index.ts).
 * The app root (App.tsx, main.tsx, ...) and the folders from before FSD
 * (components/, contexts/, ...) may import any layer's public API.
 *
 * Each check proves itself on a made-up violation first, so a pattern that
 * stops matching fails loudly instead of passing everything.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gameFoldersCurrent } from './game-folders.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMPORT = /(?:from|import\(|vi\.(?:mock|doMock)\()\s*['"](\.{1,2}\/[^'"]+)['"]/g;

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) yield path;
  }
}

const importsOf = (file, source) =>
  [...source.matchAll(IMPORT)].map((m) => ({
    spec: m[1],
    target: normalize(join(dirname(file), m[1])),
  }));

// ── Backend ──────────────────────────────────────────────────────

const backend = join(root, 'backend');
const backendFeatures = join(backend, 'features');
const backendServices = join(backend, 'services');

const sliceIn = (base, path) => {
  const rel = relative(base, path);
  return rel.startsWith('..') ? null : (rel.split(sep)[0] ?? null);
};

function backendViolations(file, source) {
  const mine = sliceIn(backendFeatures, file);
  const inServices = !relative(backendServices, file).startsWith('..');
  if (!mine && !inServices) return [];
  return importsOf(file, source).flatMap(({ spec, target }) => {
    const theirs = sliceIn(backendFeatures, target);
    if (!theirs || theirs === mine) return [];
    return [
      mine
        ? `${relative(root, file)} imports ${spec} (slice ${theirs}): slices don't import each other`
        : `${relative(root, file)} imports ${spec} (slice ${theirs}): services/ can't import a slice`,
    ];
  });
}

// ── Frontend ─────────────────────────────────────────────────────

const src = join(root, 'frontend', 'src');
const LAYERS = ['pages', 'widgets', 'features', 'entities', 'shared'];

/** The layer and slice a path is in, or null outside the FSD layers. */
function placeOf(path) {
  const rel = relative(src, path);
  if (rel.startsWith('..')) return null;
  const [layer, slice] = rel.split(sep);
  if (!LAYERS.includes(layer)) return null;
  // shared/ has segments, not slices: any of it may use any other.
  return { layer, slice: layer === 'shared' ? null : slice, rest: rel.split(sep).slice(2) };
}

/** Whether an import names a slice's public API: the slice folder itself or its index. */
const isPublic = (rest) =>
  rest.length === 0 || (rest.length === 1 && /^index(\.tsx?)?$/.test(rest[0]));

function frontendViolations(file, source) {
  const from = placeOf(file);
  // Stories, tests and their fixtures (*Mocks.ts) may reach inside the slices they describe.
  if (/(\.(stories|test)\.tsx?|Mocks\.ts)$/.test(file)) return [];
  return importsOf(file, source).flatMap(({ spec, target }) => {
    const to = placeOf(target);
    if (!to) {
      // An FSD layer importing an old folder is allowed for now, except shared/ and entities/,
      // which sit at the bottom and must not depend on the app.
      const old = relative(src, target).split(sep)[0];
      if (
        from &&
        (from.layer === 'shared' || from.layer === 'entities') &&
        !relative(src, target).startsWith('..')
      )
        return [
          `${relative(root, file)} imports ${spec} (${old}/): ${from.layer}/ can't depend on the app`,
        ];
      return [];
    }
    if (from && LAYERS.indexOf(to.layer) < LAYERS.indexOf(from.layer))
      return [
        `${relative(root, file)} imports ${spec}: ${from.layer}/ can't import ${to.layer}/ (a layer above)`,
      ];
    const sameSlice = from && from.layer === to.layer && from.slice === to.slice;
    if (!sameSlice && to.slice && !isPublic(to.rest))
      return [
        `${relative(root, file)} imports ${spec}: use ${to.layer}/${to.slice}'s public API (its index.ts)`,
      ];
    return [];
  });
}

// ── Prove, then check ───────────────────────────────────────────

const proofs = [
  backendViolations(
    join(backendFeatures, 'plans', 'x.ts'),
    "import { a } from '../teams/service';",
  ),
  backendViolations(
    join(backendServices, 'x.ts'),
    "import { a } from '../features/plans/service';",
  ),
  frontendViolations(
    join(src, 'entities', 'person', 'x.ts'),
    "import { a } from '../../features/plans';",
  ),
  frontendViolations(
    join(src, 'features', 'plans', 'ui', 'x.tsx'),
    "import { a } from '../../teams/ui/Card';",
  ),
  frontendViolations(join(src, 'shared', 'x.ts'), "import { a } from '../contexts/AppContext';"),
];
const allowed = [
  backendViolations(
    join(backendFeatures, 'plans', 'x.ts'),
    "import { a } from '../../services/s3';",
  ),
  frontendViolations(
    join(src, 'features', 'plans', 'ui', 'x.tsx'),
    "import { a } from '../../teams';",
  ),
  frontendViolations(
    join(src, 'features', 'plans', 'ui', 'x.tsx'),
    "import { a } from '../model/use';",
  ),
];
if (proofs.some((p) => p.length !== 1) || allowed.some((p) => p.length !== 0)) {
  console.error('check-architecture: the checks no longer tell a violation from an allowed import');
  process.exit(1);
}

const found = [
  ...[...sourceFiles(backend)].flatMap((f) => backendViolations(f, readFileSync(f, 'utf8'))),
  ...[...sourceFiles(src)].flatMap((f) => frontendViolations(f, readFileSync(f, 'utf8'))),
  // The games' server folders are found by pattern into one generated file (0032).
  ...(gameFoldersCurrent()
    ? []
    : ['backend/features/games/folders.generated.ts is stale: run `just contract`']),
];
if (found.length > 0) {
  console.error(
    `Layout rules broken (docs/decisions/0008):\n${found.map((v) => `  ${v}`).join('\n')}`,
  );
  process.exit(1);
}
console.log('Layout rules hold: no slice imports another, and every layer imports only below it.');
