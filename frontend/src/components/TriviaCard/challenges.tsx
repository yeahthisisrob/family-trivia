/**
 * The Trivia tab's special challenges (docs/decisions/0032): the session
 * modes (Casino Rush, Slot Machine), then every game whose folder gives it
 * a weekly round. The tiles and the flow both read this list.
 */
import { GAME_MODES, type GameModeId } from '@family-trivia/shared';
import type { SvgIconComponent } from '@mui/icons-material';
import CasinoIcon from '@mui/icons-material/Casino';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import type { Game } from '../../games/kit';
import { GAMES } from '../../games/registry';
import { colors } from '../../shared/design-system';

export interface Challenge {
  id: string;
  label: string;
  description: string;
  icon: SvgIconComponent;
  gradient: string;
  accent: string;
  badge: string;
  /** The color around the game while it's played. */
  frame: string;
  /** The game, for a round. */
  game?: Game;
}

const SESSIONS: Record<GameModeId, Omit<Challenge, 'id' | 'label' | 'description'>> = {
  'casino-rush': {
    icon: CasinoIcon,
    gradient: colors.gameMode.slotMachine.gradient,
    accent: colors.gameMode.slotMachine.accent,
    badge: '3× OR BUST',
    frame: colors.casinoRush.accent,
  },
  'slot-machine': {
    icon: SmartToyIcon,
    gradient: `linear-gradient(135deg, ${colors.accent.purple} 0%, ${colors.accent.pink} 100%)`,
    accent: colors.accent.gold,
    badge: 'SPIN TO WIN',
    frame: colors.casinoRush.gold,
  },
};

export const CHALLENGES: Challenge[] = [
  ...GAME_MODES.map((m) => ({
    id: m.id,
    label: m.label,
    description: m.description,
    ...SESSIONS[m.id],
  })),
  ...GAMES.flatMap((g) =>
    g.round
      ? [
          {
            id: g.id,
            label: g.label,
            description: g.round.description,
            icon: g.icon,
            gradient: g.look.gradient,
            accent: g.look.accent,
            badge: g.badge,
            frame: g.look.frame ?? colors.accent.purple,
            game: g,
          },
        ]
      : [],
  ),
];

export const challengeByLabel = (label: string): Challenge | undefined =>
  CHALLENGES.find((c) => c.label === label);
