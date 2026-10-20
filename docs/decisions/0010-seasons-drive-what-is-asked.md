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
- A season with no start letter opens with one made from its settings
  (`shared/src/season-opening.ts`): a welcome, how last season went (people
  and answers given in this circle), and what this one is (trivia, pace,
  teams, nothing expires). It shows only in the season's first 14 days, so
  a season already under way doesn't announce itself. A written start
  letter always wins; the editor previews the made one and can start from it.
- Each season says what its trivia is about (`trivia`): **general** (the
  categories), **family** (only Our Family), or **mixed** (Our Family as one
  more category). Our Family questions come from the family itself
  (`backend/services/familyTrivia.ts`): who-is-whose questions built from
  current ties with no AI, and questions an AI writes from other people's
  answers, which must cite the answer and are dropped unless the correct
  choice is really in it. They're checked against the family, not against
  world knowledge, so the general fact-checker skips them. A family that
  hasn't shared enough yet gets a general question instead.
- A season can also be **off**: facts only. The daily questions about the
  family go on; the one eligibility gate (`checkPlayEligibility`) turns trivia
  and the arcade away with `no_trivia_this_season`, and the Trivia tab opens
  on the results with a line saying why.

- Every season can be looked back on (Family › Look back,
  `GET /seasons/review`): its numbers, the questions most of the family
  answered side by side, what was loved, everyone's season, and every day's
  question with everyone's answers. A season can be made into a printed
  book: a 6 × 9 inch PDF a print-on-demand press takes as it is
  (`features/look-back/book.ts`, EB Garamond embedded under the OFL). When
  it's written (warm or playful), AI plans it first: a foreword and chapters
  by theme, then each chapter's opening, a few paragraphs telling its story,
  one per request so none outruns the API's 30 seconds. All of it is written
  once per season and tone and kept under `books/`; the PDF is kept too and made again only when the
  season's answers change or someone asks. Nothing is replaced: every PDF is
  kept beside the input it was set from (answers, people, writing, layout
  version) and its wraparound cover (back, spine sized to the page count,
  front, with bleed; `services/press/cover.ts`), and every piece of writing
  beside the AI's prompt and reply.

- Between seasons nothing new is asked, but the family's pages come back:
  Home shows a memory a day (`GET /family/memory`), one past question with
  everyone's answers, asked on this calendar day in an earlier year when
  there is one, else a day from the archive, the same for everyone all day.

## Consequences
The season is the one switch for what the app asks: general trivia, family
trivia, both, or none.
