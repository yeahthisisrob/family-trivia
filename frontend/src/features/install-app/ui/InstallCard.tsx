/**
 * Home's one-time tip, on a phone that hasn't added the app yet (0031).
 * Closed once, it stays closed on this device; the circle menu keeps the
 * how-to for later.
 */
import CloseIcon from '@mui/icons-material/Close';
import { Card, IconButton, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { dismissHint, hintDismissed, type InstallState, useInstall } from '../model/install';
import { InstallSteps } from './InstallSteps';

export const InstallCardView: React.FC<{ state: InstallState; onClose: () => void }> = ({
  state,
  onClose,
}) => (
  <Card sx={{ p: 2.5, mb: 2, borderRadius: 3 }}>
    <Stack direction="row" sx={{ alignItems: 'flex-start', mb: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, flex: 1 }}>
        Keep it on your home screen
      </Typography>
      <IconButton size="small" aria-label="Not now" onClick={onClose} sx={{ mt: -0.5 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
    <InstallSteps {...state} onInstall={() => void state.prompt().then((ok) => ok && onClose())} />
  </Card>
);

export const InstallCard: React.FC = () => {
  const state = useInstall();
  const [closed, setClosed] = useState(hintDismissed);
  if (closed || state.installed || (state.platform === 'desktop' && !state.canPrompt)) return null;
  return (
    <InstallCardView
      state={state}
      onClose={() => {
        dismissHint();
        setClosed(true);
      }}
    />
  );
};
