import CasinoIcon from '@mui/icons-material/Casino';
import { lazy } from 'react';
import { colors } from '../../shared/design-system';
import { defineGame, type RoundProps } from '../kit';

const CasinoRush = lazy(() => import('./CasinoRush'));

// A weekly round only: three questions, triple or nothing. Its routes and
// files are in backend/features/games/casino-rush.
export default defineGame({
  id: 'casino-rush',
  label: 'Casino Rush',
  description: '3 questions, 60s each — triple or bust',
  badge: '3× OR BUST',
  icon: CasinoIcon,
  look: { ...colors.gameMode.slotMachine, frame: colors.casinoRush.accent },
  order: 0,
  round: {
    description: '3 questions, 60s each — triple or bust',
    Round: ({ catchUp, ...p }: RoundProps) => <CasinoRush {...p} isCatchingUp={catchUp} />,
  },
  session: { result: (won) => (won ? 'JACKPOT' : 'BUSTED') },
});
