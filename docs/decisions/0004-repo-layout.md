# 0004. `frontend/`, `backend/`, `infra/`, `shared/`; shared ships source

- Status: Accepted
- Date: 2026-10-16

## Context
The Lambda lived inside the CDK package (`cdk/lambda`), and the CDK tsconfig
compiled it with a different TypeScript. `shared/` had to be built to `dist/`
before the backend could build or test, while the frontend read its source.

## Decision
Four top-level packages: `frontend/` (React app), `backend/` (the API
Lambda), `infra/` (CDK), `shared/` (types and the OpenAPI contract).
`shared` exports TypeScript source; esbuild, Vite and Vitest compile it where
it's used, so there is no build step to forget. The generated API types in
`shared/generated/` are committed and CI fails if they drift from the schema.

## Consequences
Paths in old notes (`cdk/lambda/...`) moved to `backend/...`. Anything that
consumes `shared` must compile TypeScript, which every consumer already does.
