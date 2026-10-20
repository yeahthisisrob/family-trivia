import CasinoIcon from '@mui/icons-material/Casino';
import { lazy } from 'react';
import { games } from '../../shared/design-system';
import { defineGame } from '../kit';

export default defineGame({
  id: 'casino',
  label: 'Casino',
  description: 'Slots, blackjack and roulette from one pool of credits',
  badge: 'SLOTS · 21',
  icon: CasinoIcon,
  look: { gradient: games.casino.arcadeTile, accent: games.casino.gold },
  order: 1,
  Play: lazy(() => import('./CasinoLobby')),
});
