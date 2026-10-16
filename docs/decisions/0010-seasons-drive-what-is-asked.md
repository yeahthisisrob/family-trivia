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

## Consequences
Season content modes (family-only questions, facts only) build on this: the
season becomes the one switch for what the app asks.
