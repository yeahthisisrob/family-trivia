import GamepadIcon from '@mui/icons-material/Gamepad';
import { lazy } from 'react';
import { colors } from '../../shared/design-system';
import { defineGame, type GameProps } from '../kit';

const Tetris = lazy(() => import('./TetrisGame'));

export default defineGame({
  id: 'tetris',
  label: 'Tetris',
  description: '60 seconds to clear as many lines as you can',
  badge: '60s BLOCKS',
  icon: GamepadIcon,
  look: colors.gameMode.tetris,
  order: 2,
  Play: (p: GameProps) => <Tetris {...p} mode="arcade" />,
});
