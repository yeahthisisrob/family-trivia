import GamepadIcon from '@mui/icons-material/Gamepad';
import { lazy } from 'react';
import { colors } from '../../shared/design-system';
import { defineGame, type GameProps, type RoundProps } from '../kit';

const Tetris = lazy(() => import('./TetrisGame'));

export default defineGame({
  id: 'tetris',
  label: 'Tetris',
  description: '60 seconds to clear as many lines as you can',
  badge: '60s BLOCKS',
  icon: GamepadIcon,
  look: { ...colors.gameMode.tetris, frame: colors.accent.purple },
  order: 2,
  Play: (p: GameProps) => <Tetris {...p} mode="arcade" />,
  round: {
    description: '60s to clear lines — score your multiplier',
    Round: ({ catchUp, onComplete, ...p }: RoundProps) => (
      <Tetris {...p} isCatchingUp={catchUp} onComplete={(r) => onComplete(r.pointsEarned)} />
    ),
  },
});
