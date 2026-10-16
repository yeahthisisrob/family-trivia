/** Every feature-slice route is in the OpenAPI contract (docs/decisions/0008: OpenAPI-first). */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const spec = readFileSync(join(root, '../shared/schemas/api.openapi.yaml'), 'utf8');

const routes = readdirSync(join(root, 'features')).flatMap((slice) => {
  const file = readFileSync(join(root, 'features', slice, 'routes.ts'), 'utf8');
  return [...file.matchAll(/'(GET|PUT|POST|DELETE|PATCH) (\/[^']*)'/g)].map((m) => ({
    method: m[1]!.toLowerCase(),
    path: m[2]!,
  }));
});

test.each(routes)('$method $path is in the contract', ({ method, path }) => {
  const at = spec.indexOf(`\n  ${path}:\n`);
  expect(at, `${path} missing from api.openapi.yaml`).toBeGreaterThan(-1);
  const block = spec.slice(at + 1).split(/\n {2}\/|\ncomponents:/)[0]!;
  expect(block).toContain(`\n    ${method}:`);
});
