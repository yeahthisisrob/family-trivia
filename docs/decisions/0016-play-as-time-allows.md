# 0016. Play as time allows: nothing is lost by coming back late

- Status: Accepted
- Date: 2026-10-19

## Context
People play when life lets them: a busy month, a hospital stay, a parent
who opens it twice a week, friends who check in on a Sunday. A daily game
that punishes a missed day turns a week away into a reason never to come
back. Catch-up existed, but as a special mode with its own benchmark,
off to the side. And a circle of friends won't play daily at all.

## Decision
- **Nothing in an open season expires.** Every question asked this season
  waits for each person until the season ends. Coming back after two weeks
  means "you have 14 waiting", not "you missed 14".
- **Catching up is just playing.** One queue per person, oldest first, any
  length of sitting: one question or twenty, and it stops when they do.
  Answers count the same whatever day they're given. The leaderboard ranks
  what people know, not when they showed up, and it shows "still to play"
  next to each name so a late start never looks like losing.
- **No streaks, no guilt.** No "you missed" copy, no streak counts, no
  shaming nudges. Reminders say what is new and waiting, never what was
  missed, and each person picks how often (daily, weekly, never).
- **A circle's pace is a setting** (`season.pace`: daily or weekly). Weekly
  asks a handful of questions once a week. Friends circles default to weekly.
- **Low friction everywhere:**
  - an invite link opens straight to Google sign-in with the passphrase
    filled in;
  - the app installs to the home screen;
  - every question answers in one tap or a few words;
  - reacting to something counts as playing;
  - being named in someone's memory brings a person in ("added a memory with
    you");
- **Group reveals wait for the group.** Feud and group results open when
  enough of the circle has answered (a setting), so a late answer still
  changes the result.
- **After a season ends**, the unscored fill-in carries on as before.

## As built (Oct 19, 2026)
- Waiting trivia counts from each person's own first play this season: every
  day before today owes one question, whatever anyone else did, and a late
  start owes nothing for the days before. It no longer measures against the
  most active player.
- Home shows one "Waiting for you" line (trivia and past questions), the
  daily question's backlog runs oldest first, the leaderboard shows "still
  to play", and streak counts are gone from results, timelines, leaderboards
  and profiles.
- **Pace is built** (`season.pace`, Admin › Seasons): a play period is a day,
  or a week from Monday. A weekly season has one question for everyone and a
  handful of trivia (`perWeek`, five by default) each week, and one thread;
  what's waiting counts weeks. New friends and mixed circles start weekly.
- **Welcome back:** after more than a day and a half away, Home opens with one
  line of what's new since (who shared answers, comments and reactions on
  yours), once per return.
- **No reminders outside the app** (Oct 20, 2026): no emails or pushes. They
  need setup this project doesn't want, and the app's job is to be worth
  opening, not to chase anyone.

## Consequences
The catch-up mode and its slot benchmark go away and become the queue.
Scoring no longer depends on dates. Admins see who has joined, who has
things waiting and who hasn't opened the app in a while, so they can reach
out themselves. The app never does that for them.
