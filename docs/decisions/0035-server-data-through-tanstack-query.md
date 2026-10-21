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
  cap of six in flight, retries, `ApiError`). A `read` can stand in for the
  request when one request answers many reads (every reaction bar on screen
  in one), still in the contract's shape. `useCircleInfiniteQuery` reads a
  list page by page (the timeline), with the same circle-first key.
- **Changes say what they make stale.** `useCircleMutation` takes
  `invalidates` (feature keys, as prefixes) and resolves after those reads
  have answered again; `onSuccess` can put the server's answer straight in
  the cache, and `onMutate` can show a change at once and put it back on
  failure. Both act on the circle the change was made in. With
  `refreshInBackground` it resolves once saved and asks those reads again
  without waiting: for a change whose own answer is what the person waits
  for (an answer to today's question shows its fact at once). A change
  saved outside a mutation calls `useCircleInvalidate` with those keys: a
  game saves its own score and round (the game kit), so the Arcade and the
  Trivia tab name what that changed once the game is over.
- **Status, not Suspense.** Cards keep their own skeletons and empty states
  and read `data`, `isPending` and `isError`; each card keeps its own
  `ErrorBoundary`.
- **Stories and tests get a fresh client each** (`.storybook/preview.tsx`,
  `frontend/src/test/serverData.tsx`); MSW and the fake API answer per circle.

## Migration plan
Slice by slice, one PR each, each with a test that two circles never share a
cached read:
1. Done: Home's feature cards (this record): the welcome line, sharing,
   plans, threads, teams, the memory a day, celebrations.
2. Done: Home's older cards and the reactions store. Today's question
   (`features/daily-question`), Family Feud (`features/family-feud`), who
   has played (`features/who-has-played`) and the week's answers
   (`features/fact-summary`) moved out of `components/`; the timeline reads
   `entities/timeline` through `TimelineContext`, whose comments wait for
   step 5. The trivia grid still asks again on the Trivia tab's
   `refreshTimestamp` until step 3.
3. Done: Profile, Us (family home, graph, map), the Arcade, the
   leaderboard and the Trivia tab. The family, its graph, the knowledge
   index and each person's story are `entities/family` reads; someone's
   trivia and their spotlight are `entities/person` reads. Profile's parts
   moved from `components/` into `features/profile` (`ScoreHistory`,
   `UserTimeline` on `entities/timeline`, and `EditAnswers`, which edits
   past answers through `features/daily-question`). Us's story, its
   spotlight, the map and Your world are queries; the admin's story and
   index buttons and the family editor's save are mutations. Any answer
   invalidates the answerer's profile and story. The results are
   `entities/leaderboard` (`/consolidated-leaderboard`, the season part of
   the key; `season=current` opens on the active or latest season in one
   request) and replace `LeaderboardContext`; the Arcade's boards are
   `entities/high-scores`, one per game on screen. The leaderboard, the
   Arcade and the Trivia tab moved from `components/` into
   `features/leaderboard`, `features/arcade` and `features/trivia`. A
   trivia answer is a mutation that invalidates who has played, the
   results, the timeline and the answerer's profile and story; a round,
   once over, invalidates the same and the high scores; an Arcade game,
   when it closes, the high scores and the results (podium points). The
   trivia grid's `refreshTimestamp` is gone. The
   Remembering page's memories and visitors wait for the comments in
   step 5.
4. Done: Admin and settings. `AdminContext` is gone, and each tab
   reads its own data with its own loading and errors. The Admin page is
   `pages/admin`; Players, Groups and Family Tree are `features/admin-people`,
   Seasons and their letters `features/admin-seasons`, Daily Qs
   `features/admin-questions`, System `features/admin-system`, Player Data
   `features/admin-data` and the Trivia Bank `features/admin-trivia-bank`;
   the cards and the confirm step they share are `shared/admin-ui`, and
   `components/Admin` is gone. Settings (the view, its
   save, checking the models), the features every screen reads
   (`useFeatures`, no provider), backups, the family theme (`useFamilyThemeId`,
   `useSaveFamilyTheme`), who may download the archive (one read for
   Settings and the family editor), invites, every circle, who might be the
   same person and the circle menu (`/me/circles`) are queries and mutations.
   A season change invalidates the results, teams, threads, today's question
   and who has played; a change to players, groups or the tree invalidates
   the family, its graph, the results or the timeline's sides as each shows
   it. What `/app-init` carries (Home's season banner and letters, members,
   groups) is asked again quietly with `useRefreshAppInit` until step 5.
   Admin changes are sent once (`once` in ApiService and `callApi`): a busy
   answer or a lost connection can't say whether a delete, reset or import
   was done. Player Data reads a person's facts and trivia, the plays left
   open and Family Feud as stored: a fact edited or deleted invalidates
   what an answer shows in (today's question, who has played, the week's
   answers, the timeline, the profile and story), a trivia answer deleted
   what playing changes (the profile and story, the trivia grid, the
   results, the timeline), a Feud round reset or deleted Home's Feud card,
   the results (its points), the timeline and the week's answers, and a
   play closed only the open plays (whether a round can be played waits
   for step 5 with the Trivia tab's status). The Trivia Bank's stats and
   pages are queries; an import or a delete invalidates them and System's
   question count.
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
