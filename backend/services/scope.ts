/**
 * Which circle a piece of work is for (docs/decisions/0015).
 *
 * Every stored key a feature uses is relative to its circle. The storage layer
 * (services/s3.ts, services/media.ts) turns it into the real key here, so
 * features never build circle paths and can't reach another circle's data.
 * Work with no circle set fails loudly instead of guessing.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface Scope {
  circleId: string;
  /** Stored at the bucket root (the deployment's first circle, before import). */
  root: boolean;
}

/** Sign-in data and invite links, shared by every circle. Everything else belongs to one. */
const GLOBAL_PREFIXES = ['circles.json', 'accounts/', 'invites/', 'memory-links/'];

const store = new AsyncLocalStorage<Scope>();
let fallback: Scope | null = null;

/** Tests (and only tests) run without a request, so they set a default. */
export function setFallbackScope(scope: Scope | null): void {
  fallback = scope;
}

export function currentScope(): Scope {
  const scope = store.getStore() ?? fallback;
  if (!scope) throw new Error('No circle set for this work: wrap it in inCircle');
  return scope;
}

export const isGlobalKey = (key: string) => GLOBAL_PREFIXES.some((p) => key.startsWith(p));

const prefixOf = (scope: Scope) => (scope.root ? '' : `circles/${scope.circleId}/`);

/** The real stored key for a key a feature uses. */
export function physicalKey(key: string): string {
  return isGlobalKey(key) ? key : prefixOf(currentScope()) + key;
}

/**
 * The feature's key for a real stored key, or null when it isn't this
 * circle's (a root circle never lists other circles or sign-in data).
 */
export function logicalKey(physical: string): string | null {
  const scope = currentScope();
  if (scope.root) return physical.startsWith('circles/') || isGlobalKey(physical) ? null : physical;
  const prefix = prefixOf(scope);
  return physical.startsWith(prefix) ? physical.slice(prefix.length) : null;
}

// ── Running work in a circle ────────────────────────────────────

type Hook = () => Promise<void>;
const enterHooks: Hook[] = [];
const exitHooks: Hook[] = [];

/** Run before work in a circle starts (load that circle's settings). */
export const onCircleEnter = (hook: Hook) => enterHooks.push(hook);
/** Run after work in a circle ends, even when it fails (flush usage). */
export const onCircleExit = (hook: Hook) => exitHooks.push(hook);

/** Run fn with every key it touches scoped to this circle. */
export function inCircle<T>(scope: Scope, fn: () => Promise<T>): Promise<T> {
  return store.run(scope, fn);
}

/** Serve one request in a circle: inCircle, with the enter and exit hooks around it. */
export function serveInCircle<T>(scope: Scope, fn: () => Promise<T>): Promise<T> {
  return inCircle(scope, async () => {
    for (const hook of enterHooks) await hook();
    try {
      return await fn();
    } finally {
      for (const hook of exitHooks) await hook();
    }
  });
}

/**
 * A cache that keeps one value per circle, so a warm Lambda serving two
 * circles back to back never hands one circle another's data.
 */
function perCircle<T>(make: () => T): () => T {
  const byCircle = new Map<string, T>();
  return () => {
    const { circleId } = currentScope();
    let value = byCircle.get(circleId);
    if (value === undefined) {
      value = make();
      byCircle.set(circleId, value);
    }
    return value;
  };
}

export interface CircleCache<T> {
  /** The value while it's fresh, else null. */
  get(): T | null;
  /** The last value however old (to fall back on when a read fails). */
  stale(): T | null;
  set(value: T): void;
  clear(): void;
}

/** One cached value per circle that goes stale after ttlMs. */
export function circleCache<T>(ttlMs: number): CircleCache<T> {
  const entry = perCircle(() => ({ value: null as T | null, at: 0 }));
  return {
    get: () => {
      const e = entry();
      return e.value !== null && Date.now() - e.at < ttlMs ? e.value : null;
    },
    stale: () => entry().value,
    set: (value) => {
      const e = entry();
      e.value = value;
      e.at = Date.now();
    },
    clear: () => {
      const e = entry();
      e.value = null;
      e.at = 0;
    },
  };
}
