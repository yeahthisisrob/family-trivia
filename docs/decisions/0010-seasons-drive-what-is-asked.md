# 0010. Seasons decide what the family is asked, and carry letters

- Status: Accepted
- Date: 2026-10-16

## Context
Between seasons the app still prompted for daily facts and Family Feud, and
the end-of-season dialog appeared on every visit with a generic "Season
complete!" message. A season can end for hard reasons; the message should be
the family's own words, shown once.

## Decision
- No season running means nothing new is asked: no daily fact prompt, no
  Family Feud, no trivia. The app is a place to look back.
- Each season can carry two letters, `notes.start` and `notes.end`: an
  optional title, Markdown, and an optional photo. Admins write them in
  Admin › Seasons › Letters with a live preview.
- Each person sees a letter once. Dismissing it is stored on the server
  (`seasons/seen/{userId}.json`), so it doesn't return on another device.
- Photos live in the family's private data bucket under `media/`. The
  browser uploads and reads them with short-lived presigned URLs
  (`backend/services/media.ts`); the bucket stays private.
- The old plain-text `message` still works as an end letter.
- Each season says what its trivia is about (`trivia`): **general** (the
  categories), **family** (only Our Family), or **mixed** (Our Family as one
  more category). Our Family questions come from the family itself
  (`backend/services/familyTrivia.ts`): who-is-whose questions built from
  current ties with no AI, and questions an AI writes from other people's
  answers, which must cite the answer and are dropped unless the correct
  choice is really in it. They're checked against the family, not against
  world knowledge, so the general fact-checker skips them. A family that
  hasn't shared enough yet gets a general question instead.

## Consequences
The season is the one switch for what the app asks. A facts-only season (no
trivia at all) is the next mode to add.
