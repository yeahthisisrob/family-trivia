# 0007. Identity comes from the token, never the request

- Status: Accepted
- Date: 2026-10-16

## Context
Every route verified the JWT, then read `userId` (and admin routes read
`adminUserId`) from the query string or body. Any signed-in player could act
as anyone, including an admin, by sending another id. Player-facing endpoints
also returned the whole user config, passphrases included, and a public
passphrase check could be used to guess them.

## Decision
`requireAuth` (backend/middleware/requireAuth.ts) rewrites identity fields
from the verified token before the handler runs: `adminUserId` is always the
caller; `userId` is the caller unless the route is registered with
`SUBJECT`, where `userId` names the person being looked at (a profile, a
member summary, the player an admin is managing). Handlers stay unchanged.

Passphrases leave the server only through admin routes
(`toPublicUserConfig` strips them everywhere else). The legacy public
`/validate-passphrase` route is gone; linking happens only in `/auth/google`.
The only unauthenticated route is `/auth/google`.

## Consequences
A handler can keep reading `userId` from the request and be safe. New routes
default to "acts for the caller"; marking one `SUBJECT` is a deliberate,
reviewable choice. Handlers should move to the `userId` argument over time.
