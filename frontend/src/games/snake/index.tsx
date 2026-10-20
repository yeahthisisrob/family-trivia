import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { lazy } from 'react';
import { colors } from '../../shared/design-system';
import { defineGame } from '../kit';

export default defineGame({
  id: 'snake',
  label: 'Snake',
  description: 'Collect letters to spell trivia answers',
  badge: 'SPELL IT',
  icon: SportsEsportsIcon,
  look: colors.gameMode.snake,
  order: 5,
  Play: lazy(() => import('./SnakeGame')),
});
