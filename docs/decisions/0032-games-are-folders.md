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
- **Session modes (as first decided).** Casino Rush and Slot Machine ran
  several steps with routes of their own and were listed in `GAME_MODES`.
  The next section moved them into folders.

## Sessions are folders too (Oct 20, 2026)
- **A game that needs server code has a second folder,
  `backend/features/games/<id>/`,** in the games slice, named like its
  frontend folder. Its `index.ts` default-exports `defineServerGame({ id,
  label, routes, storage, status, olderAnswers, admin, aboutPlayer,
  podium })`; every part is optional.
- **Found by pattern.** The Lambda is bundled by esbuild, which has no
  `import.meta.glob`, so `scripts/game-folders.mjs` writes
  `features/games/folders.generated.ts`, one export per folder (`just
  contract` runs it; `just layout` fails while it is stale). The games
  slice registers each folder in `services/gameRegistry`, which is how the
  rest of the backend reads across games without importing the slice.
- **Routes by pattern.** A folder's `routes` are keyed by method and
  action (`'POST start'`) and served at `/<id>/<action>` behind the usual
  sign-in. Casino Rush and the Slot Machine keep every path they had
  (`/casino-rush/start`, `/slot-machine/spin`...), so an installed app that
  is still cached keeps working. `backend/index.ts` lists none of them.
- **Stored data does not move.** Each folder keeps its keys in `keys.ts`
  and declares its `storage` prefix (`casino-rush/`, `slot-machine/`); the
  keys are the same strings as before, and a test in each folder holds
  them to it. History entries keep their `isCasinoRush`, `casinoSessionId`
  and `isSlotMachine` fields; `gameModeOf` and `playOf` read them.
- **Read through the registry, not by name:** app-init's `gameStatuses`
  (same keys as before, the id in camelCase), the admin game-session views
  and reset (`type` is the label; a new `game` field carries the id), the
  archive export (`games.json`, one key per game with storage), the member
  summary's prompt lines, older answers kept in a game's own files (for the
  leaderboard and the profile), and the round status (`active` says a play
  is open).
- **Podium points come from the folders.** A game whose board earns 3, 2
  and 1 leaderboard points says `podium: true` in its server folder. Tetris,
  Curling and the Slot Machine do, so the boards that count are the same
  three as before and standings don't change.
- **On the frontend** Casino Rush and the Slot Machine are folders in
  `frontend/src/games/` with a `round`; `GAME_MODES` is gone. A game may
  leave out `Play` (a round only), say it is played in another game's
  lobby (`lobby: { of: 'casino' }`: the Casino lists its guests from the
  registry), and declare a `session` so its answers group into one card on
  the timeline. Their calls go through the kit's `gameRequest`.

## Consequences
- A new game is a folder, a story, and nothing else. A game that truly needs
  its own server logic (Crossword builds its grid on the server; the Casino
  keeps a credit pool) still adds a backend slice and its OpenAPI entries.
- The arcade bonus on the leaderboard counts the boards whose server
  folders say `podium: true`; adding or removing one changes standings, so
  it is a decision, not a default.
- Some things still name these games outside their folders, because they
  describe stored data or the contract: the legacy history flags read by
  `gameModeOf`, the OpenAPI contract and its generated types, the design
  system's game palettes (`colors.casinoRush`, `colors.gameMode.*`, as for
  every game), and tests that use stored history shapes as fixtures.
- Anyone can submit a score for any id. The scores are per circle and only
  members can post, so the cost of a junk id is a board nobody sees.
