/** The how-to, any time, from the circle menu (0031). */
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import type React from 'react';
import { useInstall } from '../model/install';
import { InstallSteps } from './InstallSteps';

export const InstallDialog: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const state = useInstall();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 800 }}>Add to Home Screen</DialogTitle>
      <DialogContent>
        <InstallSteps
          {...state}
          onInstall={() => void state.prompt().then((ok) => ok && onClose())}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
};
