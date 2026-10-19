/**
 * Any screen's own avatar, with the person's chosen picture in it when they
 * have one (docs/decisions/0024). Takes everything MUI's Avatar takes; the
 * children (initials) show until a picture is chosen.
 */
import { Avatar, type AvatarProps } from '@mui/material';
import type React from 'react';
import { useAvatarUri } from '../model/avatars';

export const PersonAvatar: React.FC<AvatarProps & { personId: string }> = ({
  personId,
  src,
  sx,
  ...rest
}) => {
  const chosen = useAvatarUri(personId);
  const picture = src ?? chosen;
  return (
    <Avatar
      src={picture}
      sx={[...(Array.isArray(sx) ? sx : [sx]), !src && !!chosen && { bgcolor: 'transparent' }]}
      {...rest}
    />
  );
};
