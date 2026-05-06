// Shared confirmation dialog for destructive actions.
// Replaces 6+ identical confirm dialogs across admin tabs.

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open, title, message, confirmLabel = 'Delete', onConfirm, onCancel,
}) => (
  <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
    <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 600 }}>{title}</DialogTitle>
    <DialogContent>
      {typeof message === 'string'
        ? <Typography variant="body2">{message}</Typography>
        : message}
    </DialogContent>
    <DialogActions sx={{ px: 2, pb: 2 }}>
      <Button onClick={onCancel} size="small">Cancel</Button>
      <Button variant="contained" color="error" size="small" onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </DialogActions>
  </Dialog>
);

export default ConfirmDialog;
