/**
 * A person's face, the one used everywhere: a photo the family added, else the
 * picture they chose from the shared library (docs/decisions/0024), else
 * initials in their color.
 */

import type { AvatarChoice } from '@family-trivia/shared';
import { Avatar } from '@mui/material';
import type React from 'react';
import { colors, identityColor, usePaper } from '../../../shared/design-system';
import { useAvatarUri } from '../model/avatars';

/** What the family calls someone before their name; never an initial. */
const TITLES =
  /^(grandma|grandpa|granny|gran|nana|nanna|nan|papa|pop|pops|mimi|gigi|aunt|auntie|aunty|uncle|cousin|great|mom|mum|dad|mr|mrs|ms|dr)\.?$/i;

/** "Grandma Grace" → G, "Aunt Ivy" → I, "Mary Jo Smith" → MS, "Bob" → B. */
export const initials = (name: string) => {
  const words = name.split(/\s+/).filter(Boolean);
  const named = words.filter((w) => !TITLES.test(w));
  const use = named.length ? named : words;
  const first = use[0]?.[0] ?? '?';
  const last = use.length > 1 ? (use.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
};

export const Face: React.FC<{
  id: string;
  name: string;
  size?: number;
  photo?: string;
  remembered?: boolean;
  dim?: boolean;
  /** A light ring, for a face set on its own color. */
  ring?: boolean;
  /** Show this choice instead of theirs (the picker's preview); null for initials. */
  avatar?: AvatarChoice | null;
}> = ({ id, name, size = 48, photo, remembered, dim, ring, avatar }) => {
  const paper = usePaper();
  const chosen = useAvatarUri(id, avatar);
  const src = photo ?? chosen;
  return (
    <Avatar
      src={src}
      alt=""
      sx={{
        width: size,
        height: size,
        fontSize: size / 3.1,
        fontWeight: 700,
        bgcolor: remembered ? paper.paper : src && !photo ? 'transparent' : identityColor(id),
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
};
