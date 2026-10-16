# 0009. People and relationships that change over time

- Status: Accepted
- Date: 2026-10-16

## Context
The family was modelled as one root couple with two sides, groups of people,
and a loose list of relationships that nothing wrote. Three different member
lists (player accounts, the hierarchy, S3 listings) decided who was in the
family, and every feature assumed everyone was present, active and alive.

Real families aren't like that. Couples separate and re-partner; children
have two homes; an ex, an ex's parents and a new partner may all play; people
step back for a while and return; people die and should be remembered, not
deleted.

## Decision
`shared/src/people.ts` is the model, and `backend/services/family/roster.ts`
is the only place features ask "who is in this family" and "who is playing".

- **People** have a `participation` (`playing`, `paused`, `not-playing`)
  separate from being in the family, and an optional `memorial` (date,
  dedication, photo, shown on home). Remembered people never play.
- **Ties** are stored edges only: `partner` (married, partnered, engaged;
  `ended` by separation, divorce or being widowed), `parent` (birth,
  adoptive, step, foster, guardian) and declared `kin` for when the people
  in between aren't in the app. Everything else (full, half and step
  siblings, grandparents, aunts and uncles, cousins, in-laws) is derived in
  one place. In-laws run through current partners only.
- **Households** replace the two fixed sides: any number, and a person can
  be in more than one.
- **Care rules**: AI prompts use `mentionableRelations` (never a former
  partner, never someone who opted out); roast mode is never generated for
  a remembered person; a remembered person's birthday is a day for
  remembering, not a party.
- **Storage**: `family/family.json` (version 2). Until a family has one,
  the version 1 `family/hierarchy.json` is read through
  `fromLegacyHierarchy`, so nothing breaks and nothing needs migrating.

## Consequences
Player lists (`getAllUsers`, `getUsersInGroup`) only return people playing
now, which fixes leaderboards, rotations and notifications in one place.
Past answers, facts and timelines keep everyone, remembered people included.
Opening a remembered person shows their Remembering page instead of the
everyday one (`features/remembering`): the last things they told the family,
what it loved most, the family's memories (comments of type `memorial` on
their id), every answer by month, and a keepsake page to save or print.
The admin and the family tree move to this model next; the version 1 tree
view keeps reading the hierarchy until then.
