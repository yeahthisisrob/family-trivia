/**
 * Any screen's own avatar, with the person's chosen picture in it when they
 * have one (docs/decisions/0024). Takes everything MUI's Avatar takes; the
 * children (initials) show until a picture is chosen.
 */
import { Avatar, type AvatarProps } from '@mui/material';
import type React from 'react';
import { useAvatarLook } from '../model/avatars';
import { lookSx } from './lookSx';

export const PersonAvatar: React.FC<AvatarProps & { personId: string }> = ({
  personId,
  src,
  sx,
  ...rest
}) => {
  const look = useAvatarLook(personId);
  const shown = src ? undefined : look;
  return (
    <Avatar
      src={src ?? look?.src}
      sx={[...(Array.isArray(sx) ? sx : [sx]), ...(shown ? [lookSx(shown)] : [])]}
      {...rest}
    />
  );
};
