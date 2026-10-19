# 0025. Know yourself: what you love, kept and noted

- Status: Accepted
- Date: 2026-10-19

## Context
Answers say a lot about a person: the band they keep naming, the beach they
go back to. The knowledge index (what each person talks about) only grew when
an admin pressed a button, the "did you know" after an answer disappeared
once read, and a profile showed loves as bare chips.

## Decision
- **The index fills itself.** After an answer (the day's question or a
  fill-in), the app asks `POST /me/knowledge` to read that person's new
  answers; no admin button needed (it stays, for catching up). Never for
  someone who opted out of AI mentions.
- **Notes on what you love.** The same step writes a short, well-known "did
  you know" about each of the few things a person loves most (a band, a place,
  a dish), once, kept in their index (`notes`). Personal things ("my mom's
  lasagna") get none. Bands are tagged when the answers make it clear.
- **The profile leads with it.** "What you love", grouped by kind, in their
  own words, with the note, and a way to go further that needs no account or
  API: tour dates for a band, the map for a place, a search for a show.
- **The fact after an answer is kept and knows you.** It's written with what
  they've talked about before, and their latest answers on the profile show
  it again.

## Consequences
Live data (actual tour dates, setlists) can come later from a music service,
behind the same `tag`. Everything here is the circle's own answers plus what
the model already knows.
