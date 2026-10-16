/** A person's face: their photo if the family added one, else initials in their color. */
import { Avatar } from '@mui/material';
import type React from 'react';
import { colors, identityColor, paper } from '../../../shared/design-system';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const Face: React.FC<{
  id: string;
  name: string;
  size?: number;
  photo?: string;
  remembered?: boolean;
  dim?: boolean;
  /** A light ring, for a face set on its own color. */
  ring?: boolean;
}> = ({ id, name, size = 48, photo, remembered, dim, ring }) => (
  <Avatar
    src={photo}
    alt=""
    sx={{
      width: size,
      height: size,
      fontSize: size / 3.1,
      fontWeight: 700,
      bgcolor: remembered ? paper.paper : identityColor(id),
      color: remembered ? paper.ink : colors.onColor,
      border: remembered
        ? `2px solid ${colors.medal.gold}`
        : ring
          ? `3px solid ${colors.onColor}`
          : 'none',
      fontFamily: remembered ? paper.serif : undefined,
      opacity: dim ? 0.6 : 1,
    }}
  >
    {initials(name)}
  </Avatar>
);
