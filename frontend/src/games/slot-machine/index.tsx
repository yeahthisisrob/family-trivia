import SmartToyIcon from '@mui/icons-material/SmartToy';
import { lazy } from 'react';
import { colors, games } from '../../shared/design-system';
import { defineGame, type GameProps, type RoundProps } from '../kit';

const SlotMachine = lazy(() => import('./SlotMachine'));

// A weekly round (spin for a category and a multiplier, then one question),
// and the casino's slots. Its routes and files are in
// backend/features/games/slot-machine.
export default defineGame({
  id: 'slot-machine',
  label: 'Slot Machine',
  description: 'Spin for a random category + multiplier',
  badge: 'SPIN TO WIN',
  icon: SmartToyIcon,
  look: {
    gradient: `linear-gradient(135deg, ${colors.accent.purple} 0%, ${colors.accent.pink} 100%)`,
    accent: colors.accent.gold,
    frame: colors.casinoRush.gold,
  },
  order: 0,
  Play: (p: GameProps) => <SlotMachine {...p} mode="arcade" />,
  lobby: {
    of: 'casino',
    label: 'Slots',
    badge: 'BET & SPIN',
    look: { gradient: games.casino.slotsTile, accent: games.casino.slotsIcon },
  },
  round: {
    description: 'Spin for a random category + multiplier',
    Round: ({ catchUp, ...p }: RoundProps) => <SlotMachine {...p} isCatchingUp={catchUp} />,
  },
  session: {},
});
