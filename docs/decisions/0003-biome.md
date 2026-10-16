# 0003. Biome for format and lint, with debt counted

- Status: Accepted
- Date: 2026-10-16

## Context
ESLint and Prettier covered only the frontend; the backend, infra and shared
code had no lint or format at all.

## Decision
Biome formats and lints the whole repo (`biome.jsonc`) in well under a second.
Auto-fixable rules are errors and get fixed on commit. Rules that need a human
and fire on existing code are switched off or down to warnings as `DEBT (n)`
with their count at the time, so the list burns down instead of growing.

## Consequences
One tool, one config, one command (`just fix`). Architecture rules (FSD
boundaries, slice isolation) belong in the same file as `noRestrictedImports`
overrides when those layers land.
