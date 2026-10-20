import AcUnitIcon from '@mui/icons-material/AcUnit';
import { lazy } from 'react';
import { colors } from '../../shared/design-system';
import { defineGame, type GameProps } from '../kit';

const Curling = lazy(() => import('./CurlingGame'));

export default defineGame({
  id: 'curling',
  label: 'Curling',
  description: 'Hold and release — land closest to the button',
  badge: 'HOLD · SWEEP',
  icon: AcUnitIcon,
  look: colors.gameMode.curling,
  order: 3,
  Play: (p: GameProps) => <Curling {...p} mode="arcade" />,
});
