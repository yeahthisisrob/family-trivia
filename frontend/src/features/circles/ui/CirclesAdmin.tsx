import type { Circle, CircleKind } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { CIRCLE_KINDS, KIND_ICON, KIND_LABEL, KIND_LINE } from '../../../entities/circle';
import { enterCircle } from '../../../session';
import { DEFAULT_THEME_ID, THEMES } from '../../../shared/design-system';
import { circlesApi } from '../api/circlesApi';

interface Props {
  /** The circle open now. */
  currentId: string;
  /** What to call the owner in a new circle, to start with. */
  yourName: string;
}

/**
 * Admin › Circles for the deployment's owner: every circle, and starting a
 * new one (a family, friends, or both) with its own theme. Others see nothing.
 */
export const CirclesAdmin: React.FC<Props> = ({ currentId, yourName }) => {
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    circlesApi
      .all()
      .then((r) => setCircles(r.owner ? r.circles : null))
      .catch(() => setCircles(null));
  }, []);

  if (!circles) return null;
  return (
    <Card sx={{ p: 2.5, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1 }}>
          Your circles
        </Typography>
        <Button startIcon={<AddRoundedIcon />} onClick={() => setStarting(true)}>
          Start a circle
        </Button>
      </Box>
      <Stack spacing={1}>
        {circles.map((c) => {
          const Icon = KIND_ICON[c.kind];
          return (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Icon sx={{ color: 'text.secondary' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {KIND_LABEL[c.kind]}
                  {c.id === currentId && ' · you are here'}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Stack>
      <StartCircle open={starting} yourName={yourName} onClose={() => setStarting(false)} />
    </Card>
  );
};

const StartCircle: React.FC<{ open: boolean; yourName: string; onClose: () => void }> = ({
  open,
  yourName,
  onClose,
}) => {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<CircleKind>('friends');
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [me, setMe] = useState(yourName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { circle, circles } = await circlesApi.create({ name, kind, themeId, yourName: me });
      const mine = circles.find((c) => c.id === circle.id);
      if (mine) enterCircle(mine, circles);
    } catch {
      setError("Couldn't start the circle. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>Start a circle</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Name"
            placeholder="The Crew"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Box>
            <Label>Who's in it</Label>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
              {CIRCLE_KINDS.map((k) => {
                const Icon = KIND_ICON[k];
                return (
                  <Choice key={k} selected={kind === k} onClick={() => setKind(k)}>
                    <Icon />
                    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mt: 0.5 }}>
                      {KIND_LABEL[k]}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                      {KIND_LINE[k]}
                    </Typography>
                  </Choice>
                );
              })}
            </Box>
          </Box>

          <Box>
            <Label>How it looks</Label>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: 1,
              }}
            >
              {THEMES.map((t) => (
                <Choice key={t.id} selected={themeId === t.id} onClick={() => setThemeId(t.id)}>
                  <Box
                    sx={{
                      height: 28,
                      borderRadius: 1,
                      background: t.schemes.light.header,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'flex-end',
                      p: 0.5,
                    }}
                  >
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        bgcolor: t.schemes.light.secondary.main,
                      }}
                    />
                  </Box>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', mt: 0.75 }}>
                    {t.name}
                  </Typography>
                </Choice>
              ))}
            </Box>
          </Box>

          <TextField
            fullWidth
            label="What this circle calls you"
            value={me}
            onChange={(e) => setMe(e.target.value)}
          />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={busy || !name.trim() || !me.trim()}
          onClick={() => void start()}
        >
          Start and open it
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
    {children}
  </Typography>
);

const Choice: React.FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({
  selected,
  onClick,
  children,
}) => (
  <ButtonBase
    onClick={onClick}
    aria-pressed={selected}
    sx={{
      position: 'relative',
      display: 'block',
      textAlign: 'left',
      p: 1.25,
      borderRadius: 2,
      border: 2,
      borderColor: selected ? 'primary.main' : 'divider',
      bgcolor: selected ? 'action.selected' : 'transparent',
      transition: 'border-color 0.15s, background-color 0.15s',
    }}
  >
    {selected && (
      <CheckCircleRoundedIcon
        sx={{ position: 'absolute', top: 6, right: 6, fontSize: 18, color: 'primary.main' }}
      />
    )}
    {children}
  </ButtonBase>
);
