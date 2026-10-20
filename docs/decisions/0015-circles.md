# 0015. Circles: one sign-in, many groups

- Status: Accepted
- Date: 2026-10-19

## Context
The app was built for one family per deployment. Sign-in maps an email to a
single player (`config/auth-map.json`), and every feature reads and writes
fixed keys (`config/users.json`, `family/family.json`, `books/…`). The same
people who keep a family together also keep friendships going: an old crew,
college friends, people who lost someone together. They need the same
things (a rhythm, memories in their own words, a way to remember the people
they've lost) without a second app or a second login, and without seeing
each other's family.

## Decision
- **A circle is a group of people who play together.** It has a `kind`
  (`family` or `friends`), a name, its own people, passphrases, admins,
  seasons, settings and content. The words come from the circle's kind
  through one vocabulary layer (`shared/src/vocabulary.ts`): "family" and
  "relatives" for a family, "circle" and "friends" for friends. Features
  never hard-code family words.
- **An account is a Google sign-in.** `accounts/{accountId}.json` lists its
  memberships: `{ circleId, userId }`. A passphrase links an account to one
  person in one circle (the global index `passphrases.json` → `{ circleId,
  userId }`), so the same login can join a family and a circle of friends.
  The token names the account. Each request names its circle
  (`X-Circle` header), and `requireAuth` checks the membership and passes the
  handler the person's `userId` in that circle. Not a member: 403, always.
  Each browser tab (and the home-screen app) keeps the circle and person it
  opened as (`session.ts`): the browser's storage is shared by every tab, so
  a switch in one never changes what another asks for. Switching reloads
  the app. Anything kept on the device per choice (a theme, a dismissed
  note) is kept per circle.
- **Caches are per circle.** One request can read several circles (Your
  world, a joined circle), so a cache is keyed by circle as well as by
  person (`circleCache` in `services/scope.ts`, or the circle in the key).
- **Storage is scoped in one place.** `services/s3.ts` prefixes every key with
  `circles/{circleId}/` from a per-request context (AsyncLocalStorage) that
  `requireAuth` sets. Features keep their keys and need no changes. Only
  sign-in data (`accounts/`, `passphrases.json`, `circles.json`) and the
  shared trivia bank sit outside a circle. A key read with no circle set
  throws, so a missed scope fails loudly, never across circles.
- **Scheduled jobs run once per circle**, each inside that circle's context
  (nightly questions, notifications, backups).
- **A circle can hold family and friends together.** `kind` is `family`,
  `friends` or `mixed` and only picks the starting words and question sets.
  Who is in it and how they're tied is free, so "our people" (family plus
  the friends who are family) is just a circle. Questions draw on the ties
  each person actually has: a parent question goes to someone with a parent
  in the circle, a "how you met" question to friends.
- **Circles are private from each other.** Someone in two circles sees each
  one separately, and nothing (answers, people, the graph, AI prompts)
  crosses between them unless it is shared on purpose.
- **Shared spaces cross circles on purpose.** A Remembering page, a plan or
  a book can be shared from the circle that owns it into other circles (a
  friend's memorial shared with his family's circle; a reunion plan open to
  two crews). The owner's admin grants view or add, and can take it back.
  The data stays in the owning circle, and every contribution says which
  circle it came from. A share link can also let people with no account
  add a memory to a Remembering page and nothing else.
- **One account, one home.** The home view brings together what is new
  across someone's circles (waiting questions, memories that name them,
  plans), each labeled with its circle, without mixing their data.
- **One people and relationships model for every kind** (0009), not a copy
  per kind. Tie kinds are data in one registry (`shared/src/ties.ts`): each
  says what it means, whether it can end, its words, and the rules for what
  it implies. Family ties (partner, parent, kin) and friend ties (met, with
  when and where; eras such as school, a job, a city; crews) are entries in
  the same registry. Derived relations, the roster, the care rules
  (`mentionableRelations`, remembered people, ended ties), the graph, the
  map and AI prompts all read it. A circle's kind only picks the default
  ties and words. Any tie works in any circle: a family friend in a family,
  two brothers in a friends circle. A remembered friend gets the same
  Remembering page as a remembered relative.
- **Every feature is built once, for every kind.** Questions, seasons,
  Feud, memories, plans, books and settings read the circle's kind through
  the vocabulary and tie registry, never `if (kind === 'friends')` scattered
  through features. A new kind is data, and the tests run each slice in a
  family circle and a friends circle.
- **The existing family becomes the first circle** in a one-off import:
  backup and count check first (0014), copy, never move. The old keys stay
  as the rollback until the import is confirmed.

## Consequences
This is 1.0.0: sign-in and storage change shape. Every feature works in any
circle without changes, and the tests run each slice inside a test circle.
Adding a circle kind later (a team, a club) is a vocabulary entry and some
registry ties, not a fork. 0009's fixed tie types become registry entries;
existing `family.json` data reads unchanged.
