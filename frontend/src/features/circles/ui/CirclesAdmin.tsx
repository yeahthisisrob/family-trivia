import type { Circle } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { KIND_ICON, KIND_LABEL } from '../../../entities/circle';
import { enterCircle } from '../../../session';
import { circlesApi } from '../api/circlesApi';
import { CircleFields, isReady, type NewCircle, newCircle } from './CircleFields';

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
  const [form, setForm] = useState<NewCircle>(newCircle(yourName));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { circle, circles } = await circlesApi.create(form);
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
          <CircleFields value={form} onChange={setForm} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || !isReady(form)} onClick={() => void start()}>
          Start and open it
        </Button>
      </DialogActions>
    </Dialog>
  );
};
