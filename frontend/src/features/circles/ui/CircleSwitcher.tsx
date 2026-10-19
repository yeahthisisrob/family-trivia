import type { CircleKind, MyCircle } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import Diversity1RoundedIcon from '@mui/icons-material/Diversity1Rounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FamilyRestroomRoundedIcon from '@mui/icons-material/FamilyRestroomRounded';
import Groups2RoundedIcon from '@mui/icons-material/Groups2Rounded';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useMyCircles } from '../model/useMyCircles';

const KIND_ICON: Record<CircleKind, typeof Groups2RoundedIcon> = {
  family: FamilyRestroomRoundedIcon,
  friends: Groups2RoundedIcon,
  mixed: Diversity1RoundedIcon,
};

const KIND_LABEL: Record<CircleKind, string> = {
  family: 'Family',
  friends: 'Friends',
  mixed: 'Family and friends',
};

const JOIN_ERRORS: Record<string, string> = {
  INVALID_PASSPHRASE: "That passphrase didn't match. Check it and try again.",
  USER_ALREADY_LINKED: 'That person is already linked to another Google account. Ask the admin.',
  PASSPHRASE_AMBIGUOUS:
    'That passphrase is used in more than one circle. Ask the admin for a new one.',
};

interface Props {
  /** Shown when the circles haven't loaded (and for anyone in one circle). */
  fallbackTitle: string;
  color: string;
  mutedColor: string;
}

/**
 * The header title: the circle you're in. With more than one, it opens a
 * menu to move between them; anyone can join one more with a passphrase.
 */
export const CircleSwitcher: React.FC<Props> = ({ fallbackTitle, color, mutedColor }) => {
  const { circles, current, join, open } = useMyCircles();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [joining, setJoining] = useState(false);
  const several = circles.length > 1;

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-haspopup="menu"
        aria-label={`${current?.name ?? fallbackTitle}: circles`}
        sx={{ flex: 1, justifyContent: 'flex-start', gap: 0.25, borderRadius: 1, minWidth: 0 }}
      >
        <Typography
          noWrap
          sx={{
            fontWeight: 800,
            fontSize: { xs: '1.05rem', sm: '1.15rem' },
            letterSpacing: 0.3,
            color,
          }}
        >
          {current?.name ?? fallbackTitle}
        </Typography>
        {several && <ExpandMoreRoundedIcon sx={{ fontSize: 20, color: mutedColor }} />}
      </ButtonBase>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        {circles.map((c) => (
          <CircleRow
            key={c.id}
            circle={c}
            selected={c.id === current?.id}
            onClick={() => {
              setAnchor(null);
              if (c.id !== current?.id) open(c);
            }}
          />
        ))}
        {circles.length > 0 && <Divider />}
        <MenuItem
          onClick={() => {
            setAnchor(null);
            setJoining(true);
          }}
        >
          <ListItemIcon>
            <AddRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Join another circle" />
        </MenuItem>
      </Menu>

      <JoinDialog open={joining} onClose={() => setJoining(false)} onJoin={join} />
    </>
  );
};

const CircleRow: React.FC<{ circle: MyCircle; selected: boolean; onClick: () => void }> = ({
  circle,
  selected,
  onClick,
}) => {
  const Icon = KIND_ICON[circle.kind];
  return (
    <MenuItem selected={selected} onClick={onClick}>
      <ListItemIcon>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={circle.name} secondary={KIND_LABEL[circle.kind]} />
      {selected && <CheckRoundedIcon fontSize="small" sx={{ ml: 1, color: 'primary.main' }} />}
    </MenuItem>
  );
};

const JoinDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  onJoin: (passphrase: string) => Promise<void>;
}> = ({ open, onClose, onJoin }) => {
  const [passphrase, setPassphrase] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!passphrase.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onJoin(passphrase);
    } catch (err) {
      const type = (err as { errorType?: string }).errorType ?? '';
      setError(JOIN_ERRORS[type] ?? 'Joining failed. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Join another circle</DialogTitle>
      <DialogContent>
        <Box
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the passphrase the circle's admin sent you. You'll keep every circle you're
            already in.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            error={error !== null}
            helperText={error ?? ' '}
            autoComplete="off"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void submit()}
          disabled={busy || !passphrase.trim()}
        >
          Join
        </Button>
      </DialogActions>
    </Dialog>
  );
};
