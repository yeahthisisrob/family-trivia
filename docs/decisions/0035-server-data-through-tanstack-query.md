# 0035. Server data through TanStack Query

- Status: Accepted
- Date: 2026-10-20

## Context
Screens load server data in `useEffect` with their own loading and error
state, some through contexts that hold it, and some through
`shared/api/CacheService.ts`: an in-memory cache keyed by hand-written
strings and cleared by hand in many files. Keys such as `daily_memory` and
`upcoming_birthdays_11` leave out the circle: only the page reload on a
circle switch keeps one circle's answer out of another (0015). A key nobody
clears after a change serves the old list (a deleted date stayed in the
list for up to a minute). Every screen also repeats
the same loading, refresh-after-save and stale-data code.

## Decision
- **Server data goes through TanStack Query** (`@tanstack/react-query`, an
  exact version), set up once in `frontend/src/shared/api/query/`:
  `createQueryClient` (fresh for 60 seconds, the old cache's default; asked
  again when the app comes back to the front; no retries, since ApiService
  already retries a busy server and a dropped connection) and
  `ServerDataProvider` in `main.tsx`.
- **Every key starts with the tab's circle.** `useCircleQuery` builds the key
  as `['circle', <tab circle>, ...feature key, path, query]` (`keys.circle`)
  and sends that same circle in the request (`X-Circle`), so an answer can
  only be cached under the circle that asked for it. `keepPrevious` keeps
  only the same circle's last answer. Signing out (`clearSession`) clears the
  whole cache. Features never import `@tanstack/react-query` themselves;
  Biome's `noRestrictedImports` allows it only in that folder and the test
  helpers.
- **Reads are typed by the contract.** `useCircleQuery` takes a path and
  method from `shared/generated` (`shared/api/contract.ts`, `callApi`) and its
  data has the contract's type. Requests still go through ApiService (its
  cap of six in flight, retries, `ApiError`).
- **Changes say what they make stale.** `useCircleMutation` takes
  `invalidates` (feature keys, as prefixes) and resolves after those reads
  have answered again; `onSuccess` can put the server's answer straight in
  the cache, and `onMutate` can show a change at once and put it back on
  failure. Both act on the circle the change was made in.
- **Status, not Suspense.** Cards keep their own skeletons and empty states
  and read `data`, `isPending` and `isError`; each card keeps its own
  `ErrorBoundary`.
- **Stories and tests get a fresh client each** (`.storybook/preview.tsx`,
  `frontend/src/test/serverData.tsx`); MSW and the fake API answer per circle.

## Migration plan
Slice by slice, one PR each, each with a test that two circles never share a
cached read:
1. Home's feature cards (this record): the welcome line, sharing, plans,
   threads, teams, the memory a day, celebrations.
2. Home's older cards in `components/` (today's question, Family Feud, who
   has played, today's answers, the timeline) and the reactions store.
3. Profile, Us (family home, graph, map), the Arcade, the leaderboard.
4. Admin and settings.
5. The contexts that hold server data (`FamilyDataContext`,
   `UserStatusContext`, `TimelineContext`, ...) become queries.
6. Delete `CacheService.ts` and ApiService's `cacheKey` options; the fatal
   error pause and circuit breaker move into ApiService itself.

## Consequences
A screen's server data is a hook call: loading, errors, refresh on focus and
after a change come with it, and no key can leave out the circle. Until the
migration ends there are two caches; a change in a migrated slice does not
clear CacheService entries of slices that haven't moved, so a slice moves
together with the reads its changes affect. The frontend gains one runtime
dependency (about 11 kB gzipped).
