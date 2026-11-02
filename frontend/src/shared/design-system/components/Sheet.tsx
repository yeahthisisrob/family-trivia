/**
 * A sheet (after Herd's): a dialog that fills a phone's screen (0031) and
 * sits in the middle of a wider one, with a title and a close button; and a
 * labelled field to put in it.
 */
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Dialog,
  DialogContent,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import type { ReactNode } from 'react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Buttons that stay at the bottom while the rest scrolls. */
  actions?: ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ open, onClose, title, children, actions }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm">
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, px: 2.5, pt: 2, pb: 0.5 }}>
        <Typography
          variant="h6"
          component="h2"
          sx={{
            flex: 1,
            minWidth: 0,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          {title}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} edge="end">
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <DialogContent sx={{ pt: 1 }}>{children}</DialogContent>
      {actions && (
        <Stack
          direction="row"
          sx={{
            gap: 1,
            px: 2.5,
            py: 1.5,
            borderTop: 1,
            borderColor: 'divider',
            alignItems: 'center',
          }}
        >
          {actions}
        </Stack>
      )}
    </Dialog>
  );
};

/** A small label over a control, and a hint under it. */
export const Field: React.FC<{ label: string; children: ReactNode; hint?: string }> = ({
  label,
  children,
  hint,
}) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography
      variant="overline"
      component="div"
      sx={{ color: 'text.secondary', lineHeight: 1.6, mb: 0.5, fontWeight: 700 }}
    >
      {label}
    </Typography>
    {children}
    {hint && (
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
        {hint}
      </Typography>
    )}
  </Box>
);
