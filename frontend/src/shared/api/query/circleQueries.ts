/**
 * Server data, kept per circle (docs/decisions/0035, 0015). Every query key
 * starts with the tab's circle, and the request names that same circle, so
 * an answer can only ever be cached, and shown, in the circle that asked for
 * it. Features use these hooks; `@tanstack/react-query` itself is imported
 * only in this folder (biome.jsonc).
 */
import {
  type InfiniteData,
  type QueryClient,
  type UseQueryResult,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import { currentCircleId } from '../../session/session';
import { type ApiPath, callApi, type ResponseOf } from '../contract';

type KeyPart = string | number | boolean | null;
type Method = 'get' | 'post' | 'put' | 'delete';

export const keys = {
  /** A server-data key: this tab's circle, then the feature's own parts. */
  circle: (...parts: readonly KeyPart[]) => ['circle', currentCircleId(), ...parts] as const,
};

interface CircleQuery<P extends ApiPath, M extends Method, S> {
  /** The feature's key, e.g. `['plans', 'view']`; invalidating `['plans']` refreshes it. */
  key: readonly KeyPart[];
  path: P;
  method?: M;
  query?: Record<string, string | number>;
  select?: (data: ResponseOf<P, M>) => S;
  enabled?: boolean;
  /** While a new key loads (a longer list), keep showing this circle's last answer. */
  keepPrevious?: boolean;
  /** Ask once while the app is open: for reads that note a visit (POST /me/since). */
  once?: boolean;
  /**
   * How to ask, when one request answers many reads (reactions: every bar on
   * screen in one request). It answers in the contract's shape for `path`,
   * asked in the circle it is given.
   */
  read?: (circle: string | null) => Promise<ResponseOf<P, M>>;
}

/** Read one route of the contract, cached in this tab's circle. */
export function useCircleQuery<P extends ApiPath, M extends Method = 'get', S = ResponseOf<P, M>>(
  q: CircleQuery<P, M, S>,
): UseQueryResult<S, Error> {
  const queryKey = keys.circle(...q.key, q.path, q.query ? JSON.stringify(q.query) : null);
  const circle = queryKey[1];
  return useQuery({
    queryKey,
    queryFn: () =>
      q.read ? q.read(circle) : callApi(q.path, { method: q.method, query: q.query, circle }),
    select: q.select,
    enabled: q.enabled,
    placeholderData: q.keepPrevious
      ? (previous, previousQuery) => (previousQuery?.queryKey[1] === circle ? previous : undefined)
      : undefined,
    ...(q.once ? { staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false } : {}),
  });
}

type PageQuery = Record<string, string | number>;

interface CircleInfiniteQuery<P extends ApiPath, S> {
  /** The feature's key, as in useCircleQuery. */
  key: readonly KeyPart[];
  path: P;
  /** The first page's query string. */
  query: PageQuery;
  /** The query string for the page after `page`, or undefined at the end. */
  next: (page: ResponseOf<P, 'get'>) => PageQuery | undefined;
  /** All the pages so far, as one answer. */
  select: (pages: ResponseOf<P, 'get'>[]) => S;
  /** While a new key loads (another filter), keep showing this circle's last answer. */
  keepPrevious?: boolean;
}

/**
 * Read a route page by page (a list that loads more as you scroll), cached in
 * this tab's circle. Asked again (on focus, after a change) it starts over
 * from the first page and asks for each page it had again.
 */
export function useCircleInfiniteQuery<P extends ApiPath, S>(q: CircleInfiniteQuery<P, S>) {
  const queryKey = keys.circle(...q.key, q.path, JSON.stringify(q.query));
  const circle = queryKey[1];
  return useInfiniteQuery<ResponseOf<P, 'get'>, Error, S, typeof queryKey, PageQuery>({
    queryKey,
    queryFn: ({ pageParam }) => callApi(q.path, { query: pageParam, circle }),
    initialPageParam: q.query,
    getNextPageParam: (last) => q.next(last),
    select: (data: InfiniteData<ResponseOf<P, 'get'>, PageQuery>) => q.select(data.pages),
    placeholderData: q.keepPrevious
      ? (previous, previousQuery) => (previousQuery?.queryKey[1] === circle ? previous : undefined)
      : undefined,
  });
}

/** The cache of one circle, as a mutation sees it. Keys are prefixes, as in `invalidates`. */
interface CircleCache {
  set: <T>(key: readonly KeyPart[], update: (current: T | undefined) => T | undefined) => void;
  invalidate: (key: readonly KeyPart[]) => Promise<void>;
}

const cacheOf = (client: QueryClient, circle: string | null): CircleCache => {
  const prefix = (key: readonly KeyPart[]) => ['circle', circle, ...key];
  return {
    set: (key, update) => {
      client.setQueriesData({ queryKey: prefix(key) }, update);
    },
    invalidate: (key) => client.invalidateQueries({ queryKey: prefix(key) }),
  };
};

interface CircleMutation<TData, TVars> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** What to ask again once it's saved; the mutation resolves after they have answered. */
  invalidates?: readonly (readonly KeyPart[])[];
  /** Show the change at once; return how to put it back if saving fails. */
  onMutate?: (vars: TVars, cache: CircleCache) => (() => void) | undefined;
  /** Saved: put the server's answer in the cache. */
  onSuccess?: (data: TData, vars: TVars, cache: CircleCache) => void;
  /**
   * Resolve once it's saved, and ask the `invalidates` reads again without
   * waiting for them: for a change whose own answer is what the person is
   * waiting to see (an answer to today's question shows its fact at once).
   */
  refreshInBackground?: boolean;
}

interface Started {
  circle: string | null;
  rollback?: () => void;
}

/**
 * Mark this circle's reads stale (and ask the ones on screen again) after a
 * change saved outside useCircleMutation: a game saves its own scores and
 * rounds (the game kit, 0032), so the Arcade and the Trivia tab name what
 * that changed once the game is over.
 */
export function useCircleInvalidate() {
  const client = useQueryClient();
  return useCallback(
    (...stale: readonly (readonly KeyPart[])[]) => {
      const cache = cacheOf(client, currentCircleId());
      return Promise.all(stale.map((key) => cache.invalidate(key))).then(() => undefined);
    },
    [client],
  );
}

/** Change something on the server, then bring this circle's cached reads up to date. */
export function useCircleMutation<TData, TVars = void>({
  mutationFn,
  invalidates = [],
  onMutate,
  onSuccess,
  refreshInBackground = false,
}: CircleMutation<TData, TVars>) {
  const client = useQueryClient();
  return useMutation<TData, Error, TVars, Started>({
    mutationFn,
    onMutate: (vars) => {
      const circle = currentCircleId();
      return { circle, rollback: onMutate?.(vars, cacheOf(client, circle)) };
    },
    onError: (_error, _vars, started) => started?.rollback?.(),
    onSuccess: async (data, vars, started) => {
      const cache = cacheOf(client, started?.circle ?? currentCircleId());
      onSuccess?.(data, vars, cache);
      const refreshed = Promise.all(invalidates.map((key) => cache.invalidate(key)));
      if (!refreshInBackground) await refreshed;
    },
  });
}
