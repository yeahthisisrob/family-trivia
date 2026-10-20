/** Share a link to join a circle, made on the spot (docs/decisions/0020). */
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded';
import { Button, type ButtonProps } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { shareLink } from '../../../shared/share';
import { inviteLink } from '../../invites';
import { circlesApi } from '../api/circlesApi';

export const InviteButton: React.FC<
  { circleId: string; circleName: string; label?: string } & Pick<ButtonProps, 'variant' | 'size'>
> = ({ circleId, circleName, label = 'Invite', variant = 'outlined', size = 'small' }) => {
  const [state, setState] = useState<'idle' | 'busy' | 'shared' | 'copied' | 'failed'>('idle');
  const go = async () => {
    setState('busy');
    try {
      const { invite } = await circlesApi.invite(circleId);
      setState(await shareLink(inviteLink(invite.token), `Join ${circleName}`));
    } catch {
      setState('failed');
    }
  };
  const done = state === 'shared' || state === 'copied';
  return (
    <Button
      variant={variant}
      size={size}
      startIcon={done ? <CheckRoundedIcon /> : <IosShareRoundedIcon />}
      disabled={state === 'busy'}
      onClick={() => void go()}
    >
      {state === 'copied'
        ? 'Link copied'
        : state === 'shared'
          ? 'Shared'
          : state === 'failed'
            ? 'Try again'
            : label}
    </Button>
  );
};
