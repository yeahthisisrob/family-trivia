# 0028. Question sets per kind of circle

- Status: Accepted
- Date: 2026-10-19

## Context
A new circle had no starter questions (they lived in one family's config
file), so newcomers went straight to the shared question, and Celebrations
never learned anyone's birthday. Trivia about the circle itself was called
"Our Family" in every circle.

## Decision
- **Starter questions per kind** (`shared/src/starters.ts`): five short ones,
  one a day before the shared questions, the first always the birthday (what
  Celebrations reads). Friends: where you live now, what's on repeat, your
  go-to order, a trip you still talk about. A circle with its own list keeps
  it. The answers also feed "What you love" (0025).
- **The circle's own category is named for it:** Our Family, Our Crew, About
  Us (`circleCategoryFor`). Any of the names counts as that category, so old
  questions keep their place.
- **A new circle's Season 1 is mixed:** general trivia plus the circle's own
  category, which asks general questions until the circle has shared enough,
  and then asks about them: what someone said, who met whom in college.

## Consequences
The cadence stays light: one starter or shared question a day, one thread,
and trivia (0016, 0022).
