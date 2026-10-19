# 0027. Memory links: anyone can add a memory

- Status: Accepted
- Date: 2026-10-19

## Context
The people with the most memories of someone the circle has lost are often
not in the circle: old friends, coworkers, a cousin who'd never play a
trivia game. Asking them to sign in to leave a few lines is a wall. A
remembered friend who never played has no answers of their own, so their
page is only what others remember.

## Decision
- **An admin makes a memory link** from the person's Remembering page, for a
  month or with no end, and shares it. Only for someone the circle remembers.
- **Anyone with the link adds a memory, no account:** their name, how they
  knew them if they like, and the memory. The page shows only that person
  (name, years, dedication) and the memories already let in, nothing else of
  the circle.
- **Memories wait for a yes**, on the Remembering page itself ("Let it in",
  "Not this one"); no separate editor. Let in, they sit with the circle's own
  memories, under the name and words they gave. At most 100 wait at once.
- **Where it lives:** the link outside any circle (`memory-links/{token}.json`,
  128 random bits in the link), the memories with the person in the circle
  (`remembering/{personId}/visitors.json`).

## Consequences
A remembered person's page can be built entirely by the people who knew
them. Taking a link back closes it at once; memories already let in stay.
