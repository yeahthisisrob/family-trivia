# 0034. Tests hold every response to the contract

- Status: Accepted
- Date: 2026-10-20

## Context
OpenAPI-first (0008) generates types from `shared/schemas/api.openapi.yaml`,
but nothing checked that a handler's response matches what the contract
says. Handlers build their bodies by hand, so the contract could drift from
the code (a missing wrapper object, a field of another type, a route that
was never described) while every test still passed. The existing contract
test only checked that the feature slices' routes were listed.

## Decision
- **Every handler response in a backend test is validated** against the
  operation's response schema for its status code (ajv). The contract
  describes `data` inside the `{ ok: true, data }` envelope, which the client
  unwraps; a body without the envelope is checked whole. An error status the
  operation does not document must be the error envelope (`ok: false`,
  `error`), and a success status it does not document is drift.
- **Hooked once**, in `backend/tests/helpers/setup.ts`: the router's table is
  read from source (`tests/helpers/routeTable.ts`: `index.ts` and every
  `features/*/routes.ts`), and each handler module is wrapped with
  `vi.doMock`, so a test that imports a handler directly is checked too.
  The check lives in `tests/helpers/contract.ts`.
- **`CONTRACT_RESPONSES`**: `strict` (the default, so `just test` and CI)
  fails the test that produced the drift; `warn` logs it; `off` skips it.
- **Every served route is in the contract** (`tests/contract.test.ts`).
  `NOT_IN_CONTRACT` in `tests/helpers/contract.ts` is the allowlist, one
  reason per route, and a test fails when an entry is no longer needed.
- On drift, decide which side is wrong: fix the contract (then
  `just contract`), or fix the code starting with a failing test.

## Consequences
The contract and the generated types stay true to what the API sends, at
least for the paths tests reach; untested routes are only checked for being
listed. Extra fields a schema does not declare still pass (JSON Schema's
default), so the check finds missing and mistyped fields, not surplus ones.
A new route needs its contract entry before its tests pass.
