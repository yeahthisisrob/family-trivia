# 0001. Why this exists: connection as families age

- Status: Accepted
- Date: 2026-10-16

## Context
Family Trivia began as a way for one family to stay close while a parent's
health declined after retirement. It gave her something to do each morning,
gave everyone something to talk about, and captured family memories during a
hard stretch of life.

Aging is rarely sudden. Roles change slowly; a parent who raised you starts
to need you. Families are also juggling kids, work, distance and their own
limits, and often separating, re-partnering and blending along the way. Most
of the guilt people carry after a loss is quiet.

> We need more conversations about this before people are drowning in grief.
> More support for caregivers and families.
> More ways to stay connected before it's too late.
> More reminders that love is not measured by perfection.
>
> — from the author, May 2026

## Decision
Every feature answers to one question: does this help a family stay connected
as it changes? Concretely, the project commits to:

1. **A daily ritual, not a grind.** Small, kind, doable in a minute. No
   streak-shaming, no guilt for missed days; catch-up is always possible.
2. **Everyone can play.** Large type, simple flows and an easy mode for older
   players or anyone who finds screens hard.
3. **Memories are the product.** Answers, facts, stories and comments are
   kept, backed up, exportable and never lost to a refactor.
4. **Families change, and the app keeps up.** People can step back, return,
   separate, re-partner and blend. People who have died are remembered with
   care, not deleted.
5. **Gentle awareness.** When someone goes quiet, the family can notice
   kindly. Never surveillance, never public scores of who is absent.
6. **Each family's privacy.** Its data stays its own (see 0006).

## Consequences
Features that boost engagement by pressure (loss-aversion streaks, public
absence) are out. Data changes need migrations and backups first. People and
relationships need a model that handles real lives, not one fixed couple.
