import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded';
import { lazy } from 'react';
import { defineGame, gameLook } from '../kit';

export default defineGame({
  id: 'scramble',
  label: 'Scramble',
  description: "Unscramble answers from everyone's own trivia",
  badge: '60s WORDS',
  icon: ShuffleRoundedIcon,
  look: gameLook(28),
  Play: lazy(() => import('./ScrambleGame')),
});
