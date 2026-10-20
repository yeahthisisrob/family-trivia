# 0032. Games are folders

- Status: Accepted
- Date: 2026-10-20

## Context
The project is open source, and a game is the easiest thing for someone new
to add. Adding one meant touching about nine files outside it: a union of
game ids in shared, a list of valid ids in the backend, the Arcade's tile
list and its render switch, color tokens, the notification labels, plus a
route and an OpenAPI entry when the game needed data. The contract had also
drifted from the code (`gameId` in the spec, `game` on the wire, and the
leaderboard route not in it at all).

## Decision
- **A game is a folder in `frontend/src/games/<id>/`** whose `index.tsx`
  default-exports `defineGame({ id, label, description, badge, icon, look,
  Play })`. `games/registry.ts` finds them with `import.meta.glob` at build
  time; the id must equal the folder name. The Arcade, the high-score boards
  and the notification labels loop over the registry. Nothing names a game.
- **One kit** (`games/kit`): `submitScore`, `getScores`, `getClues`,
  `useGameSave`, `gameLook`, and the `GameProps` every game receives.
- **Generic endpoints instead of per-game ones** (backend slice
  `features/games`, OpenAPI tag Games):
  - `GET/POST /games/scores`: any game by id;
  - `GET/PUT /games/save`: a small JSON save per player and game;
  - `GET /games/clues`: one-word-answer clues from the circle's trivia and
    answers (what Snake used to get from `/snake/questions`).
  A game id is any `^[a-z][a-z0-9-]{1,31}$`; the backend keeps no list. The
  player is the signed-in caller, never a `userId` in the body. Everything
  is scoped to the circle like all other data.
- **Removed:** `/arcade/leaderboard`, `/arcade/submit-score`,
  `/snake/questions`. Stored scores keep their keys (`arcade/scores/<id>.json`).
- **Scramble** is a new game built only from the kit, as the example to
  copy.

## Consequences
- A new game is a folder, a story, and nothing else. A game that truly needs
  its own server logic (Crossword builds its grid on the server; the Casino
  keeps a credit pool) still adds a backend slice and its OpenAPI entries.
- Trivia game modes (Casino Rush, Slot Machine, Curling and Tetris as weekly
  multipliers) are still registered in `shared/src/game-modes.ts` and wired
  by hand into the trivia flow and history; making those folders too is the
  next step.
- Anyone can submit a score for any id. The scores are per circle and only
  members can post, so the cost of a junk id is a board nobody sees.
