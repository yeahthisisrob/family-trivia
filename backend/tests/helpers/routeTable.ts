/**
 * The router's table read from source: each route key ('GET /family') with
 * the module and export that handle it. Tests import handlers directly, not
 * through the router, so this is how the contract check (contract.ts) knows
 * which operation a handler answers for. Reading the source, rather than
 * importing index.ts, keeps the router's start-up side effects out of tests.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface RouteEntry {
  /** 'GET /family': the method and path the router matches. */
  key: string;
  /** Absolute path of the module the handler comes from. */
  module: string;
  /** The handler's export name in that module. */
  exportName: string;
}

const backendRoot = join(import.meta.dirname, '../..');

// 'GET /x': requireAuth(handler, ...)  or  'GET /x': handler  or  ns.handler
const ROUTE = /'(GET|PUT|POST|DELETE|PATCH) (\/[^']*)':\s*(?:requireAuth\()?([\w$.]+)/g;
const NAMED_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'(\.[^']*)'/g;
const NAMESPACE_IMPORT = /import\s*\*\s*as\s+(\w+)\s+from\s*'(\.[^']*)'/g;

function resolveModule(fromFile: string, specifier: string): string {
  const base = resolve(dirname(fromFile), specifier);
  return existsSync(`${base}.ts`) ? `${base}.ts` : join(base, 'index.ts');
}

function routesIn(file: string): RouteEntry[] {
  const source = readFileSync(file, 'utf8');
  const named = new Map<string, { module: string; exportName: string }>();
  for (const [, names, specifier] of source.matchAll(NAMED_IMPORT)) {
    for (const part of names!.split(',')) {
      const [exportName, local = exportName] = part.trim().split(/\s+as\s+/);
      if (exportName) named.set(local!, { module: resolveModule(file, specifier!), exportName });
    }
  }
  const namespaces = new Map<string, string>();
  for (const [, local, specifier] of source.matchAll(NAMESPACE_IMPORT)) {
    namespaces.set(local!, resolveModule(file, specifier!));
  }
  return [...source.matchAll(ROUTE)].map(([, method, path, ref]) => {
    const key = `${method} ${path}`;
    const [head, member] = ref!.split('.');
    const target = member
      ? { module: namespaces.get(head!), exportName: member }
      : named.get(head!);
    if (!target?.module)
      throw new Error(`routeTable: cannot find where ${ref} in ${file} comes from`);
    return { key, module: target.module, exportName: target.exportName };
  });
}

let cached: RouteEntry[] | undefined;

/** Every route the router serves: the feature slices' tables and index.ts. */
export function routeTable(): RouteEntry[] {
  cached ??= [
    ...readdirSync(join(backendRoot, 'features')).flatMap((slice) =>
      routesIn(join(backendRoot, 'features', slice, 'routes.ts')),
    ),
    ...routesIn(join(backendRoot, 'index.ts')),
  ];
  return cached;
}
