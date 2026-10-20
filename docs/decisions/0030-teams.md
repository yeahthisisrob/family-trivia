# 0030. Teams: made while playing

- Status: Accepted
- Date: 2026-10-19

## Context
Some circles want to play together: couples, siblings, the old roommates.
Assigning teams is an editor job and gets it wrong for people the admin
doesn't know well, and people come in at different times (0016).

## Decision
- **One setting per season:** each for themselves, or teams (`season.play`),
  in Admin › Seasons.
- **People make the teams, any time in the season:** start one (you're its
  first member), ask someone on their own to team up (their yes makes the
  team, "Alice & Bob" until renamed), or ask to join a team (any member's yes
  lets you in). Joining a team takes back your other requests. Leave any
  time; an empty team goes. At most six to a team.
- **Fair whatever the size or start:** teams rank by trivia points per
  member this season, then total. Late joiners bring their points with them;
  nothing expires (0016).
- Kept per season at `seasons/{n}/teams.json`; shown on Home in a teams
  season (requests first, then standings, then what you can do).

## Consequences
No admin work beyond the one setting. Teams don't carry over between
seasons; a new season starts fresh.
