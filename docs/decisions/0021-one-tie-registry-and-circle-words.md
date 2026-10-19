# 0021. One tie registry, and words per circle

- Status: Accepted
- Date: 2026-10-19

## Context
A friends circle needs friendships, how people met, and groups that aren't
households. The easy way is a second people model for friends, or
`kind === 'friends'` checks scattered through the screens. Both fork the
code that every feature reads (0009) and drift apart, and a mixed circle
(0015) would need both at once.

## Decision
- **One model, one more tie.** A friendship is a tie like a partnership or
  a parent: `{ type: 'friend', a, b, met?: { how, when, where } }`. It is
  stored, checked (`familyProblems`) and derived (`relationOf`, `friendsOf`)
  in `shared/src/people.ts` with the rest. How two friends met reaches the
  AI wording ("friend (met in college, 2004)") through
  `mentionableRelations`.
- **The tie registry** (`shared/src/ties.ts`) holds every tie's labels,
  which ties "Add" offers in each kind of circle (a mixed circle offers
  all), how a new tie is made, and `tieEnds`, the one way to read who a tie
  connects. A circle's kind only decides what is offered first, never what
  can be stored or read: a friends circle can still hold a married couple,
  and a family can hold a friend.
- **Words, not checks** (`shared/src/vocabulary.ts`). A screen asks for a
  word ("household" or "crew", "In your family" or "In your crew") through
  `useCircleWords()`; it never checks the kind itself. Households are the
  same data as crews; only the word changes.

## Consequences
New kinds of tie, or a new kind of circle, are additions to two files. The
AI prompts take their framing from the same words next (one frame per kind,
not forked prompts).
