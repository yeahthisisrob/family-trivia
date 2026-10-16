# 0002. mise + pnpm workspace + one strict TypeScript base

- Status: Accepted
- Date: 2026-10-16

## Context
The repo had npm workspaces that left `cdk/` out, no pinned Node (local 20,
Lambda 20, esbuild target 18, README "18+"), an untracked lockfile, two React
versions installed side by side, unused root dependencies (aws-sdk v2, axios,
webpack) and TypeScript 4.9 in the CDK package. Installs weren't reproducible.

## Decision
- `mise.toml` pins node, pnpm, just, lefthook and gitleaks; CI uses
  `jdx/mise-action`, so laptops and CI run the same binaries. Node matches
  the Lambda runtime (22).
- One pnpm workspace (`pnpm-workspace.yaml`) and one committed lockfile.
  `.npmrc` turns hoisting off so a package can only import what it declares.
  Install scripts are blocked except the ones listed in `allowBuilds`.
- `tsconfig.base.json` holds the strictness every package inherits.
- `justfile` is the single entry point: `just install`, `just dev`,
  `just check`, `just deploy` (which runs `check` first).
- Backend tests moved from Jest to Vitest so the repo has one test runner.

Still to turn on in the base config, one package at a time:
`noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`.

## Consequences
`npm install` no longer works; use `just install`. A phantom dependency fails
at install time instead of in a Lambda cold start.
