# 0029. The first circle: sign in and start it

- Status: Accepted
- Date: 2026-10-19

## Context
A new deployment needed a hand-written users file dropped into its bucket,
then a sign-in with a passphrase, then a long setup wizard. The wizard was
built for one family's shape (sides, groups, a family tree) and stopped
working once new circles stopped writing the old hierarchy file. Most of
what it asked for now comes from playing (Threads, starter questions).

## Decision
- **The first sign-in starts it.** On a deployment with no circles and
  nobody in the first one, Google sign-in leads to "Start your circle": the
  same form as starting any circle (name, who it's for, how it looks, what
  it calls you). They become its owner, with Season 1 running
  (`POST /auth/start`; `GET /setup` says whether it's needed).
- **Only the owner, when one is set:** `ownerEmail` in the deployment config
  (`OWNER_EMAIL`) limits who can start it. It can only happen once.
- **The wizard is gone,** and so is the bootstrap step. The first circle is
  the bucket root, so everything later works the same.

## Consequences
Setting up a deployment is: deploy, sign in, name your circle, share a link.
