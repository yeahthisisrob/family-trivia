/** How to put the app on the home screen, for this phone (0031). */
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import InstallMobileRoundedIcon from '@mui/icons-material/InstallMobile';
import IosShareIcon from '@mui/icons-material/IosShare';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { Box, Button, Stack, Typography } from '@mui/material';
import type React from 'react';
import type { InstallState } from '../model/install';

const Step: React.FC<{ n: number; icon?: React.ReactNode; children: React.ReactNode }> = ({
  n,
  icon,
  children,
}) => (
  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
    <Box
      sx={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        fontSize: '0.8rem',
        fontWeight: 800,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}
    >
      {n}
    </Box>
    <Typography sx={{ flex: 1 }}>{children}</Typography>
    {icon && <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>}
  </Stack>
);

type Props = Pick<InstallState, 'platform' | 'installed' | 'inAppBrowser' | 'canPrompt'> & {
  onInstall: () => void;
};

export const InstallSteps: React.FC<Props> = ({
  platform,
  installed,
  inAppBrowser,
  canPrompt,
  onInstall,
}) => {
  if (installed)
    return (
      <Typography sx={{ color: 'text.secondary' }}>
        You're in the app already. It opens from your home screen, full screen, and keeps you signed
        in.
      </Typography>
    );

  if (canPrompt)
    return (
      <Stack spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <Typography>One tap and it lives on your home screen, like any other app.</Typography>
        <Button
          variant="contained"
          startIcon={<InstallMobileRoundedIcon />}
          onClick={onInstall}
          sx={{ borderRadius: 99 }}
        >
          Add to Home Screen
        </Button>
      </Stack>
    );

  if (platform === 'ios')
    return (
      <Stack spacing={1.25}>
        {inAppBrowser && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            First open this page in Safari: tap the compass or "Open in Safari".
          </Typography>
        )}
        <Step n={1} icon={<IosShareIcon />}>
          Tap <b>Share</b> (under ⋯ on newer iPhones)
        </Step>
        <Step n={2} icon={<AddBoxOutlinedIcon />}>
          Tap <b>Add to Home Screen</b>
        </Step>
        <Step n={3}>
          Tap <b>Add</b>, open it from your home screen and sign in once more there.
        </Step>
      </Stack>
    );

  return (
    <Stack spacing={1.25}>
      <Step n={1} icon={<MoreVertIcon />}>
        Open your browser's menu
      </Step>
      <Step n={2} icon={<InstallMobileRoundedIcon />}>
        Tap <b>{platform === 'android' ? 'Add to Home screen' : 'Install'}</b>
      </Step>
    </Stack>
  );
};
