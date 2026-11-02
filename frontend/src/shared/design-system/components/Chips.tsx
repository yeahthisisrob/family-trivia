/**
 * Chips for choosing (docs/decisions/0036, after Herd's): one choice in a
 * row of them, outlined and filled when on; an answer that means something
 * (going, maybe, can't) takes its tone when chosen. A person is a chip with
 * their initial in their own color.
 */
import { Avatar, Box, Chip } from '@mui/material';
import type React from 'react';
import type { ReactNode } from 'react';
import { identityColor } from '../identity';
import { colors } from '../tokens/colors';

const TONE = { good: 'success.main', watch: 'warning.main', bad: 'error.main' } as const;
export type ChipTone = keyof typeof TONE;

export interface ChoiceChipProps {
  on?: boolean;
  onClick?: () => void;
  children: ReactNode;
  /** The color it takes when on; the theme's primary without one. */
  tone?: ChipTone;
  dense?: boolean;
  /** For screen readers when the label is short ("Tue"). */
  label?: string;
}

/** One choice in a row of them. */
export const ChoiceChip: React.FC<ChoiceChipProps> = ({
  on,
  onClick,
  children,
  tone,
  dense,
  label,
}) => {
  const fill = tone ? TONE[tone] : 'primary.main';
  return (
    <Chip
      clickable
      onClick={onClick}
      aria-pressed={!!on}
      aria-label={label}
      variant={on ? 'filled' : 'outlined'}
      size={dense ? 'small' : 'medium'}
      label={
        <Box
          component="span"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, '& svg': { fontSize: 16 } }}
        >
          {children}
        </Box>
      }
      sx={
        on
          ? {
              bgcolor: fill,
              color: colors.onColor,
              borderColor: fill,
              fontWeight: 700,
              '&:hover': { bgcolor: fill, opacity: 0.9 },
            }
          : { borderColor: 'divider', fontWeight: 600 }
      }
    />
  );
};

/** A wrapping row of chips. */
export const ChipRow: React.FC<{ children: ReactNode; label?: string }> = ({ children, label }) => (
  <Box role="group" aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
    {children}
  </Box>
);

/** A person to pick: their initial in their color, filled when chosen. */
export const PersonChip: React.FC<{
  id: string;
  name: string;
  on?: boolean;
  onClick?: () => void;
}> = ({ id, name, on, onClick }) => (
  <Chip
    clickable
    onClick={onClick}
    aria-pressed={!!on}
    aria-label={name}
    variant={on ? 'filled' : 'outlined'}
    avatar={
      <Avatar sx={{ bgcolor: identityColor(id), '&&': { color: colors.onColor }, fontWeight: 800 }}>
        {name.slice(0, 1).toUpperCase()}
      </Avatar>
    }
    label={name}
    sx={
      on
        ? {
            bgcolor: 'primary.main',
            color: colors.onColor,
            borderColor: 'primary.main',
            fontWeight: 700,
            '&:hover': { bgcolor: 'primary.main', opacity: 0.9 },
          }
        : { borderColor: 'divider', fontWeight: 600 }
    }
  />
);
