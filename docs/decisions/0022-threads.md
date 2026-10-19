# 0022. Threads: connections come from one tap a day

- Status: Accepted
- Date: 2026-10-19

## Context
The people model (0009, 0021) knows how everyone is connected only if an
admin types it in. Nobody does that for a circle of friends, and the people
who most need connecting are the least likely to fill out a form. The app
should barely need editors: data comes from playing.

## Decision
- **One question a day, one tap.** Home asks "How do you know Bob?" (friends)
  or "How are you and Carol related?" (family), with the answers as chips. A
  "how you met" answer may add a year. "We haven't met yet" is an answer too.
- **Everyone answers about everyone.** The person asked about is someone
  with no known connection to you yet, a different one each day. If either of
  you answers, the thread is tied for both, so a circle of ten fills in fast.
- **The answer is the data.** It becomes a tie in family.json through the
  same versioned save as the editor (`storeFamily`), and each person's answers
  are kept at `threads/{userId}.json`. "We're family" and "We haven't met"
  make no tie.
- **Cadence:** at most one thread a day, beside the day's fact question and
  trivia, and only while a season runs. A family already connected in the
  tree is never asked.
- **Progress, not a chore:** "4 of 10 threads tied" under the card.

## Consequences
The Admin editor is now for fixing things. The next questions (how long,
inside jokes, who should meet) can follow the same one-tap pattern.
