/**
 * The one QueryClient setup for server data (docs/decisions/0035).
 */
import { QueryClient } from '@tanstack/react-query';

/** How long an answer counts as fresh: the old CacheService's default. */
const FRESH_MS = 60_000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FRESH_MS,
        // ApiService already retries a busy server (429/502/503/504) and a
        // dropped connection; a second layer would multiply the requests.
        retry: false,
        // The home-screen app comes back to the front often: what's stale is
        // asked again then.
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
  });
}
