# 0026. Plans: drop in what you're doing

- Status: Accepted
- Supersedes: the Google Calendar part of 0017
- Date: 2026-10-19

## Context
0017 planned availability with a paint-it grid and an optional Google
free/busy connection. Both ask for work before anything shows, and asking
people to connect a calendar is the kind of friction that stops a circle
(0016). People already say what they're up to in a sentence.

## Decision
- **Drop it in, in your own words.** One box: "beach weekend the 14th to the
  16th", "busy Tuesday nights", "free Saturday, anyone up for a hike?". The AI
  reads it into entries (busy, free, or a plan others can join; a day or a
  span; weekly when it repeats), each checked (`cleanDrop`), and they show at
  once with an x to take any back. Nothing to connect, no grid to paint.
- **The weeks ahead at a glance** on Home ("What's on"): the next two weeks
  as a strip, a dot for plans, free and busy days, and the best days to get
  together (nobody busy, most free, weekends first). Tap a day for who's
  free, who's away and what's planned.
- **Busy is private.** Others see "Busy", never why. Plans and free days show
  in full, and anyone can say "I'm in" or "Can't".
- **Stored per person** (`plans/people/{id}.json`), answers per plan
  (`plans/rsvp/{id}.json`); past entries are let go after four months.
  Plans run between seasons.

## Consequences
0017's later steps still stand and build on this: the day's memories coming
back afterward, a reminder, an ICS file for anyone who wants their calendar.
