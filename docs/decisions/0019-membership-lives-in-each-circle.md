# 0019. Membership lives in each circle

- Status: Accepted (refines 0015)
- Date: 2026-10-19

## Context
0015 planned two global files: one listing each account's circles and one
mapping every passphrase to its circle and person. Both copy facts each
circle already holds (its sign-in map, `config/google-auth-map.json`, and
its people's passphrases in `config/users.json`), and a copy drifts the
first time an admin edits one without the other. One sign-in can also be
in many circles, and each circle has many seasons, so whatever answers
"which circles is this person in" has to stay fast as both grow.

## Decision
- **A circle's sign-in map is the truth** of who is in it. Its admin alone
  changes it.
- **The account index** (`accounts/{hash}.json`, the email hashed, never in
  a key) lists one sign-in's circles so a request reads one file, not every
  circle. Sign-in rebuilds it from the circles, so it heals itself. Opening
  a circle that isn't in it (added since last sign-in) rebuilds it too.
- **Every request still checks the circle's own map** (`requireAuth`), so
  someone removed from a circle loses it at once, whatever the index says.
- **Passphrases are found by asking each circle** at link time, which is
  rare. No global index. A passphrase two circles share links nobody until
  an admin changes one.
- **Tokens name the sign-in, not a person.** The person comes from the
  circle the request is in (`X-Circle`), so tokens from before circles keep
  working, and nobody signs in again.

## Consequences
Nothing is stored twice that can disagree. Adding someone to a circle is one
write to that circle. Linking reads every circle's people once; at hundreds
of circles that becomes the place to add an index, built from the circles
like the account index.
