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

## Rounds (Oct 20, 2026)
- **Any game can be a weekly trivia round.** A game adds `round: {
  description, Round }` to its `defineGame`; the Trivia tab's special
  challenges and the flow come from the registry. The game plays, sets a
  multiplier, calls `lockRound`, shows the question, calls `answerRound`.
- **One set of rules for every round** (`ROUND_RULES` in
  `shared/src/game-modes.ts`): a multiplier of 0.5, 1, 2 or 3; a right answer
  earns the multiplier, plus a point when the game's score is a new best;
  one round per game per week; catch-up and the daily limit as for any
  question. Curling now earns the new-best point too, as Tetris did.
- **Endpoints:** `GET /games/rounds?games=`, `POST /games/rounds/lock`,
  `POST /games/rounds/answer`, replacing `/curling/*` and `/tetris/*`.
- **History names its mode:** new entries carry `gameMode` and
  `multiplier`. Older entries keep their `isCurling` / `isTetris` flags and
  are read through `gameModeOf`, so nothing stored changes.
- **Session modes stay as they are.** Casino Rush and Slot Machine run
  several steps with routes of their own and are listed in `GAME_MODES`.

## Consequences
- A new game is a folder, a story, and nothing else. A game that truly needs
  its own server logic (Crossword builds its grid on the server; the Casino
  keeps a credit pool) still adds a backend slice and its OpenAPI entries.
- The arcade bonus on the leaderboard (podium points for the best Tetris,
  Curling and Slot Machine scores) still names its games: changing which
  boards count would change standings people already have.
- Anyone can submit a score for any id. The scores are per circle and only
  members can post, so the cost of a junk id is a board nobody sees.
