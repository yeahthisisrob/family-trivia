import GridOnIcon from '@mui/icons-material/GridOn';
import { lazy } from 'react';
import { colors } from '../../shared/design-system';
import { defineGame } from '../kit';

export default defineGame({
  id: 'crossword',
  label: 'Crossword',
  description: "A crossword made from everyone's answers",
  badge: 'WORD PUZZLE',
  icon: GridOnIcon,
  look: colors.gameMode.crossword,
  order: 4,
  Play: lazy(() => import('./CrosswordGame')),
});
