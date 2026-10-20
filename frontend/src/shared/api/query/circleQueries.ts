/**
 * Server data, kept per circle (docs/decisions/0035, 0015). Every query key
 * starts with the tab's circle, and the request names that same circle, so
 * an answer can only ever be cached, and shown, in the circle that asked for
 * it. Features use these hooks; `@tanstack/react-query` itself is imported
 * only in this folder (biome.jsonc).
 */
import {
  type QueryClient,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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
}

/** Read one route of the contract, cached in this tab's circle. */
export function useCircleQuery<P extends ApiPath, M extends Method = 'get', S = ResponseOf<P, M>>(
  q: CircleQuery<P, M, S>,
): UseQueryResult<S, Error> {
  const queryKey = keys.circle(...q.key, q.path, q.query ? JSON.stringify(q.query) : null);
  const circle = queryKey[1];
  return useQuery({
    queryKey,
    queryFn: () => callApi(q.path, { method: q.method, query: q.query, circle }),
    select: q.select,
    enabled: q.enabled,
    placeholderData: q.keepPrevious
      ? (previous, previousQuery) => (previousQuery?.queryKey[1] === circle ? previous : undefined)
      : undefined,
    ...(q.once ? { staleTime: Number.POSITIVE_INFINITY, refetchOnWindowFocus: false } : {}),
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
}

interface Started {
  circle: string | null;
  rollback?: () => void;
}

/** Change something on the server, then bring this circle's cached reads up to date. */
export function useCircleMutation<TData, TVars = void>({
  mutationFn,
  invalidates = [],
  onMutate,
  onSuccess,
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
      await Promise.all(invalidates.map((key) => cache.invalidate(key)));
    },
  });
}
