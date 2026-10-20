# Claude Code instructions

Read `docs/decisions/` first: it says why the project is the way it is.
0001 is the purpose every change answers to: helping families stay connected
as they age and change.

## Rules that are never broken
- **No real family in the repo.** Fixtures, stories, prompts, screenshots and
  commit messages use made-up people and places (alice, bob, carol,
  Springfield). Family-specific things are data or config, never code.
  `just leaks` must pass (0006).
- **Memories are never lost.** Anything that changes stored data backs it up
  first and is reversible.
- **Families change.** Never assume one fixed couple, two sides, or that
  everyone is active and alive. Use the people model, not raw user lists.

## How the code is written (0008)
Clean Code (Robert C. Martin), DRY (one source of truth per fact), FSD in
`frontend/src` (app → pages → widgets → features → entities → shared),
VSA in `backend/` (`features/<slice>/`, no cross-slice imports; `just layout`
checks both),
OpenAPI-first (`shared/schemas/api.openapi.yaml`, then `just contract`).
Every component gets a story; a bug fix starts with a failing test.

## Toolchain (0002)
mise pins node/pnpm/just/lefthook/gitleaks. Use `just`, never npm.

```bash
just install     # once
just dev         # API on :3001 (backend/.env.local) + web on :3000
just check       # lint, leaks, deadcode, typecheck, test: what CI runs
just fix         # Biome safe fixes
just contract    # after editing shared/schemas/api.openapi.yaml
just storybook
```

## Layout (0004)
- `frontend/` React + TypeScript + MUI + Vite. Every new component gets a story.
- `backend/` one Lambda; routes in `routes/`, logic in `services/`.
- `infra/` AWS CDK.
- `shared/` types and the OpenAPI contract (source only; generated types committed).

## Patterns
- The logger service, never `console.log`.
- Arcade games are folders in `frontend/src/games/` (0032): no list to edit.
- A game becomes a weekly trivia round with `round` in its folder; rules in
  `shared/src/game-modes.ts` (ROUND_RULES), which also lists the session modes.
- MSW mocks the API in Storybook (`frontend/.storybook/mocks`).
- Backend tests check every handler response against the OpenAPI contract
  (0034, `CONTRACT_RESPONSES=strict`); a new route needs its contract entry.
- Lint rules switched off in `biome.jsonc` are counted DEBT; burn them down,
  don't add to them.
- A decision that would surprise a newcomer gets a record in `docs/decisions/`.
