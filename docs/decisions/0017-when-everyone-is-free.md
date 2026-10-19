# 0017. When everyone's free: availability that leads back to the app

- Status: Accepted
- Date: 2026-10-19

## Context
The app exists to keep people connected (0001), and the best connection
happens in person. The hardest part of getting a circle together is finding
a day. Group threads and separate scheduling tools lose the plan, and
nothing remembers the day afterward.

## Decision
- **Plans live in the circle** (`backend/features/plans`,
  `frontend/src/features/plans`). Anyone can start one:
  - a title and a window of days, or a set of candidate dates;
  - people paint the times they're free on a grid that works with one
    finger on a phone;
  - the heat map shows the best times and who can't make each one.
- **Standing availability** lets someone mark their usual free times or days
  away once, and every plan starts filled in from it.
- **A Google Calendar is optional and only gives free or busy.** Connecting it
  asks for the free/busy permission when the person chooses to, in
  Settings, never at sign-in. Event details are never read or stored.
- **Picking the time makes it real:** a calendar invite (ICS and a Google
  Calendar link) to everyone in the plan, and a reminder before it.
- **Afterward, the day comes back** as an invitation to add memories and
  photos from it, tagged with the people who were there. Those flow into
  the archive, the graph and look back like any memory.
- **Settings and admin:** plans are on or off per circle; each person picks
  whether others see their standing free times. Admins can close or remove a
  plan.

## Consequences
The app becomes a reason to see each other, and each get-together becomes
something the circle remembers. Plans need no season and keep running
between seasons, when the app is otherwise a quiet archive (0010).
