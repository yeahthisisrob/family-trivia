# Games

Every game in the Arcade is one folder here. Add a folder and the game is in
the Arcade, with a high-score board, comments and notifications for new high
scores. Nothing outside the folder changes: no list to add it to, no route,
no backend (docs/decisions/0032).

## Add a game

```
src/games/word-ladder/
  index.tsx               the game's card: defineGame({...})
  WordLadder.tsx          the game
  WordLadder.stories.tsx  a story (every component has one)
```

`index.tsx`:

```tsx
import StairsRoundedIcon from '@mui/icons-material/StairsRounded';
import { lazy } from 'react';
import { defineGame, gameLook } from '../kit';

export default defineGame({
  id: 'word-ladder',            // the folder name
  label: 'Word Ladder',
  description: 'One letter at a time, from the first word to the last',
  badge: 'WORDS',
  icon: StairsRoundedIcon,
  look: gameLook(200),          // a hue from 0 to 360
  Play: lazy(() => import('./WordLadder')),
});
```

The game gets `{ userId, onClose }` (`GameProps`) and draws itself, close
button included. Then `just dev` and open the Arcade.

## The kit

Everything a game needs from the app is in `../kit`:

| | |
|---|---|
| `submitScore(game, score)` | The player's score; their best counts on the board. |
| `getScores(game)` | The top 20, best first. |
| `getClues({ count, minLength, maxLength })` | Clues with one-word answers, made from the circle's own trivia and what people answered about themselves. |
| `useGameSave(game, initial)` | A small save per player (progress, settings; up to 16,000 characters of JSON), on every device. |
| `lockRound`, `answerRound`, `getRoundStatus` | A weekly round: keep the multiplier, answer the question, and whether it can be played now. |
| `gameLook(hue)` | A tile gradient and accent from one hue. |

They call the generic `/games/*` endpoints (`shared/schemas/api.openapi.yaml`,
tag Games), so a game never needs routes of its own. Data stays in the circle
it was played in.

## Play it as a weekly round

Any game can also be a challenge on the Trivia tab, once a week: the game
sets a multiplier, then one trivia question is worth that many points. Add a
`round` to the card:

```tsx
  round: {
    description: 'Climb in under a minute — your speed sets the multiplier',
    Round: (p: RoundProps) => <WordLadder {...p} />,
  },
```

`Round` gets `{ userId, catchUp, onClose, onComplete }`. When the game ends,
call `lockRound(id, { multiplier, score, catchUp })` (multiplier 0.5, 1, 2 or
3; a new best score adds a point) and show the question it returns; call
`answerRound(id, answer)` with the player's choice, show how it went, then
`onComplete(pointsEarned)`. The rules are the same for every game
(`ROUND_RULES` in `shared/src/game-modes.ts`); Curling and Tetris are
examples.

## Rules

- Colors come from the theme (`'primary.main'`, `'text.secondary'`) or the
  design system, never raw hex (the linter checks).
- Use made-up people in stories: alice, bob, carol.
- Keep the first screen light: `Play` is lazy, so the Arcade loads only the
  card until someone taps Play.
- `order` puts a game earlier; without it, games follow by name.

Scramble (`scramble/`) is a small game built only from the kit, to copy from.
