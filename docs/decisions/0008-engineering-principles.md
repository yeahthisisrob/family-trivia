# 0008. Engineering principles: Clean Code, DRY, FSD, VSA, OpenAPI-first

- Status: Accepted
- Date: 2026-10-16

## Context
This is a small project kept by a few people over many years. Code that is
hard to read gets rewritten instead of fixed, and every rewrite risks the
family's data. A shared set of principles keeps changes small and reviews
short.

## Decision
**Clean Code** (Robert C. Martin), as the default style:
- Names say what a thing is and why it exists; no abbreviations a newcomer
  has to decode. A function does one thing at one level of abstraction.
- Small files and functions. A file over ~400 lines is a sign to split by
  responsibility, not a goal to hit.
- Comments explain *why* (a constraint, a trade-off, a past bug), never what
  the next line does. Every config file starts with why it exists.
- Errors are handled where they can be acted on; nothing is swallowed
  silently. Use the logger, never `console`.
- Leave each file a little better than you found it (the boy scout rule):
  burn down one `DEBT` item when you touch its area.

**DRY**: one source of truth for each fact. Types live in `shared/`; a rule
(eligibility, scoring, who is in the family) lives in one service and
everything calls it. Duplication of *knowledge* is the bug; similar-looking
code that changes for different reasons may stay separate.

**FSD (Feature-Sliced Design)** in `frontend/src`: layers `app → pages →
widgets → features → entities → shared`, each importing only from layers
below it. A slice exposes a public `index.ts`; other slices never reach into
its internals. Features compose at the widget or page level where they can;
one feature may use another only through its `index.ts`. The API client,
session, config and logger live in `shared/` (`shared/api`, `shared/session`,
`shared/config`, `shared/lib/logger`), so entities and shared never depend on
the app. `scripts/check-architecture.mjs` enforces all of this (`just layout`,
pre-commit and CI), and proves itself on a made-up violation before it checks.
Stories, tests and their `*Mocks.ts` fixtures may reach inside slices.

**VSA (Vertical Slice Architecture)** in `backend/`: each feature owns its
routes, handlers, services and tests in `features/<slice>/`. Slices don't
import each other, and `services/` (what slices share) never imports a slice;
slices meet through registries there (life events, the storage links). The
same script enforces it. A change to one feature touches one folder.

**OpenAPI-first**: `shared/schemas/api.openapi.yaml` is the contract. Change
the schema, run `just contract`, and the generated types drive both the
typed client and the handlers. CI fails if the generated types drift.

**Tests and stories**: every UI component has a Storybook story (MSW mocks
the API); stories with `play` functions are tests. Backend rules get Vitest
tests against the in-memory store. A bug fix starts with a failing test.

**Small, reversible releases**: conventional commits, one concern per PR,
release-please cuts versions. Anything that changes stored data backs up
first (0001, 0006).

## Consequences
The codebase is migrating toward FSD and VSA slice by slice; until a slice
has moved, follow the pattern of the code around it and move it when you
change it substantially. Reviews can point at this record instead of
re-arguing style.
