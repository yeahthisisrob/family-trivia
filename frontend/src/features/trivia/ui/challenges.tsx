/**
 * The Trivia tab's special challenges (docs/decisions/0032): every game
 * whose folder gives it a weekly round, sessions included. The tiles and the
 * flow both read this list.
 */
import type { SvgIconComponent } from '@mui/icons-material';
import type { Game } from '../../../games/kit';
import { GAMES } from '../../../games/registry';
import { colors } from '../../../shared/design-system';

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
  /** The game, for its round. */
  game: Game;
}

export const CHALLENGES: Challenge[] = GAMES.flatMap((g) =>
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
);

export const challengeByLabel = (label: string): Challenge | undefined =>
  CHALLENGES.find((c) => c.label === label);
