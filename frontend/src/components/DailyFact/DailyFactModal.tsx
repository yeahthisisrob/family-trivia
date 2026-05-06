/**
 * DailyFactModal — Dialog wrapper around DailyFactCard.
 *
 * Auto-opens on home load if user has unanswered facts.
 * Dismissable — persists in sessionStorage so it stays gone across
 * tab switches. Only resets on hard page refresh.
 */

import CloseIcon from '@mui/icons-material/Close';
import { Dialog, IconButton, Box } from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';

import DailyFactCard from './DailyFactCard';
import { shouldShowDailyFact } from '../../api/modules/facts';
import { createLogger } from '../../utils/logger';

const logger = createLogger('DailyFactModal');

const DISMISS_KEY = 'dailyFactModalDismissed';

function isDismissed(): boolean {
  try { return window.sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

function markDismissed(): void {
  try { window.sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* ok */ }
}

interface DailyFactModalProps {
  userId: string;
  onFactSubmitted?: () => void;
  /** Called when modal is closed or all questions answered — inline card can show */
  onDismissed: () => void;
}

const DailyFactModal: React.FC<DailyFactModalProps> = ({ userId, onFactSubmitted, onDismissed }) => {
  const alreadyDismissed = isDismissed();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(alreadyDismissed);

  // If already dismissed on mount, notify parent immediately
  useEffect(() => {
    if (alreadyDismissed) onDismissed();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (alreadyDismissed) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const shouldShow = await shouldShowDailyFact(userId);
        if (!cancelled) {
          if (shouldShow) {
            setOpen(true);
          } else {
            markDismissed();
            onDismissed();
          }
          setChecked(true);
        }
      } catch (err) {
        logger.error('Failed to check daily fact status', err);
        if (!cancelled) {
          onDismissed();
          setChecked(true);
        }
      }
    }, 800);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId, onDismissed]);

  const handleClose = useCallback(() => {
    setOpen(false);
    markDismissed();
    onDismissed();
  }, [onDismissed]);

  const handleDone = useCallback(() => {
    setOpen(false);
    markDismissed();
    onDismissed();
  }, [onDismissed]);

  if (!checked) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        elevation: 8,
        sx: { borderRadius: 3, overflow: 'hidden' },
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
        <IconButton onClick={handleClose} size="small" sx={{ opacity: 0.6 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <DailyFactCard
        userId={userId}
        mode="modal"
        onFactSubmitted={onFactSubmitted}
        onDone={handleDone}
        onDismiss={handleClose}
      />
    </Dialog>
  );
};

export default DailyFactModal;
