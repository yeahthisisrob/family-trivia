# 0037. Events as a calendar

- Status: Accepted (builds on 0036)
- Date: 2026-11-01

## Context
0036's Events tab was a list of what's next, and its form a column of
fields. People read a family's events as a calendar: the month at a glance,
the week's days in order, a class on every Tuesday it happens, and who's
coming at a look. The maintainer's other family apps had already settled
how that works on a phone.

## Decision
- **The Events tab is a calendar** (`features/plans/ui/EventsCalendar.tsx`):
  a month grid, Monday first, today circled, titles in each cell on a wide
  screen and dots on a phone, or the month as an agenda (a card per day with
  something on, today always). Tap a day for its events (a sheet on a phone,
  a panel above the grid on a wider screen), an event for its page.
- **A month asks for its own days**: `GET /plans?from=&to=` (at most 93
  days; without them, the next eight weeks as before). Occurrences are
  still expanded on the server (`plansView`), so a repeating event shows on
  every day it happens.
- **One sheet to make an event** (`EventEditor`): what, the day and a time
  picker, all day, Once or Weekly with the days as chips (every 1 to 4
  weeks, until a day), where, anything to know, and who it's for as circle
  and people chips.
- **Attendance as chips** (`Attendance.tsx`): your answer is one tap on
  Going, Maybe or Can't; everyone's answers are their own chips, their
  initial in their color, the answer in its tone.
- **Add it in a sentence** (`QuickAdd`): the drop-in reader (0026) now also
  reads a clock time and a place ("Thursday 4:30 at Grandpa's"), which make
  the drop an event; each one comes back to check, and opens in the editor
  for the rest.
- **Shared pieces join the design system**: `Sheet`, `Field`, `ChoiceChip`,
  `ChipRow` and `PersonChip` (`shared/design-system/components`).

## Consequences
The calendar asks once per month shown. Busy and free drops stay on Home's
strip and out of the calendar. Editing one occurrence alone is still
"Skip this day" only (0036).
