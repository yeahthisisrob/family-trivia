# 0036. Events: a plan with details, shared with the people it's for

- Status: Accepted (extends 0026)
- Date: 2026-11-01

## Context
Plans (0026) take a sentence and keep a day: "hike Saturday, who's in?".
A family also keeps a calendar of things with a time and a place: a
birthday dinner at six, Thursday at 4:30 at Grandpa's, a class every
Tuesday and Thursday that anyone can come and watch. Those need the time,
the place, who it's for, who's coming (and with how many), a word about it,
and a way into everyone's own calendar. A parent may want one event in two
circles (a family and a co-parenting circle) and a few people, not all of
them. Another app may want to add them too. A second calendar beside Plans
would split the weeks ahead in two and copy the answers.

## Decision
- **An event is a plan with details.** The same `Drop` in
  `plans/people/{id}.json` (`shared/src/plans.ts`), `kind: 'plan'`, with
  optional `time` (`{ start, end? }`, `HH:MM`) and `zone` (IANA; all day
  when there is no time), `place`, `details`, `audience`, `skip` and
  `cancelled`. Busy, free and drop-in plans are unchanged and the
  two-week strip shows events with them (`plansView`).
- **Repeats are one weekly rule**, RRULE's `FREQ=WEEKLY`: `weekly:
  { days?, every?, until?, count? }` (`BYDAY`, `INTERVAL`, `UNTIL`,
  `COUNT`). Occurrences are expanded on read (`daysOf`), never copied;
  `skip` lists the dates that aren't happening (`EXDATE`). A rule with no
  `until` or `count` keeps going: the drop-in reader now writes the three
  months it always meant (`cleanDrop`).
- **The audience is who it's for**, enforced on the server from the token
  (0007): `audience: [{ circleId, people? }]`, all of a circle or chosen
  people in it, in any circle the creator belongs to. No audience means the
  whole circle it was made in. Only the creator and the people invited see
  the event, answer it or comment on it (`canSee`); comments ask the plans
  slice through a registry in `services/commentsService.ts`.
- **One event, kept in the circle it was made in.** Each other circle in
  its audience holds a pointer (`plans/shared-in.json`), never a copy
  (0015, 0018). Each circle's answers and comments stay in that circle;
  the detail shows other circles' answers as counts.
- **A feature a circle can turn off, with its own tab.** `features.events`
  (Settings › Features › Events, on by default, `shared/src/settings.ts`).
  On, events get a tab in the top bar (`EventsPage`: what's coming up that
  you're invited to, soonest first) beside their cards in Home's What's on;
  the top bar's tabs say which feature each needs (`NAV_ITEMS` in
  `AppHeader.tsx`, as the Arcade does). Off, the tab and Home's event cards
  are gone and every `/plans/events` route answers 403; drop-in plans stay.
- **Anyone in a circle can make one.** Its creator, or an admin of the
  circle it was made in, can change or cancel it. Cancelled events stay on
  the strip, crossed out, so nobody shows up.
- **RSVP is the plans RSVP, migrated.** `plans/rsvp/{id}.json` holds
  `{ answer: in | maybe | out, note?, guests?, at }` per person
  (`RsvpEntry`); `just migrate-rsvps` rewrites the old `"in"`/`"out"`
  strings in every circle, dry run unless `--apply`, after a backup (0014).
- **Comments are the comments slice** (`contentType: 'event'`), not a
  second system.
- **ICS, no Google.** `eventIcs` (shared) writes one VEVENT with its RRULE
  and EXDATEs: "Add to calendar" builds it in the browser, and
  `GET /plans/events/ics?id=` serves the same file to other clients.
- **Other apps use the same API with their own token**:

```http
POST /api/plans/events
Authorization: Bearer <the person's token>
X-Circle: <circle id>

{ "title": "Gymnastics", "start": "2026-11-03",
  "time": { "start": "17:30", "end": "18:30" }, "zone": "America/New_York",
  "place": "Springfield Gym", "details": "Anyone can come and watch",
  "weekly": { "days": ["TU", "TH"], "until": "2027-03-30" },
  "audience": [{ "circleId": "<family>" },
               { "circleId": "<other>", "people": ["carol"] }] }
→ 201 { "ok": true, "data": { "event": { "id": "...", ... } } }

PUT  /api/plans/events          { "id": "...", ...the same fields }   (replaces them)
GET  /api/plans/events?id=...   the event, who's invited, the answers
GET  /api/plans/events/audience the circles and people you can invite
POST /api/plans/rsvp            { "id": "...", "answer": "maybe", "guests": 2, "note": "late" }
GET  /api/plans/events/ics?id=  text/calendar
```

  Backend: `backend/features/plans/events.ts`, `eventHandlers.ts`; UI:
  `frontend/src/features/plans/ui/EventDialog.tsx`, `EventForm.tsx`.

## Consequences
The weeks ahead stay one view with one RSVP and one comment store. An event
can be fed from outside without a back door. A weekly drop saved before
this record with no end repeats until taken back, rather than for three
months. Monthly and yearly rules, a changed time for one occurrence, a
calendar subscription URL (it would need a token in the link), and
VTIMEZONE blocks (calendars read the IANA `TZID`) are left for later.
