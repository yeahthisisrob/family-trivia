/**
 * The first sign-in on a brand-new deployment (docs/decisions/0029): start
 * the first circle and you're its owner, with Season 1 already running. The
 * same form as starting any circle.
 */
import { Alert, Box, Button, Card, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { CircleFields, isReady, type NewCircle, newCircle } from './CircleFields';

export const FirstCircle: React.FC<{
  /** What Google calls them, to start with. */
  yourName: string;
  onStart: (c: NewCircle) => Promise<void>;
}> = ({ yourName, onStart }) => {
  const [form, setForm] = useState<NewCircle>(newCircle(yourName, 'family'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await onStart(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start it. Please try again.");
      setBusy(false);
    }
  };

  return (
    <Card sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: 3, maxWidth: 560, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800 }}>
        Start your circle
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 2.5 }}>
        You're the first one here. Name it, and you're its owner: the first season starts today, and
        you can invite everyone with a link.
      </Typography>
      <Stack spacing={2.5}>
        <CircleFields value={form} onChange={setForm} />
        {error && <Alert severity="error">{error}</Alert>}
        <Box>
          <Button
            variant="contained"
            size="large"
            disabled={busy || !isReady(form)}
            onClick={() => void start()}
          >
            Start it
          </Button>
        </Box>
      </Stack>
    </Card>
  );
};
