# 0006. Privacy by default: no real family in the repo

- Status: Accepted
- Date: 2026-10-16

## Context
The app runs on a family's own names, places, relationships and memories.
Those details leak into code easily: a story fixture, a prompt example, a
category named after a hometown, a screenshot. They aren't secrets, so secret
scanners don't catch them, and once public they stay public.

## Decision
- Code, fixtures, stories, prompts, screenshots and commit messages use
  made-up people and places (alice, bob, carol; Springfield).
- Anything family-specific is data, not code: places, categories, sides of
  the family and relationships live in the family's own storage and config.
- `scripts/leak-guard.mjs` runs on every commit, commit message and in CI. It
  has built-in patterns (emails, phone numbers, account ids, deployed
  resource names) plus a private list in `.leakguard`, which is gitignored
  and never committed. CI can read the same list from a `LEAKGUARD_TERMS`
  secret. gitleaks covers credentials.
- A family's data stays in its own AWS account. Nothing is sent anywhere
  except the model calls the family's own stack makes.

## Consequences
Contributors keep a `.leakguard` of their own family's names. A dedication
someone chooses to publish is skipped with a `!path` line in that file.
