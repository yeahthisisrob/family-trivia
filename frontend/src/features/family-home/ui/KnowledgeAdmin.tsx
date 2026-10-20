/**
 * Admin › Family: the family's knowledge index. Reading new answers runs a
 * batch at a time until none are left, with the count going down.
 */

import { capitalized } from '@family-trivia/shared';
import HubIcon from '@mui/icons-material/Hub';
import { Alert, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useCircleWords } from '../../../entities/circle';
import { useKnowledge } from '../../../entities/family';
import { ApiError } from '../../../shared/api/ApiService';
import { useBuildKnowledge } from '../model/familyStory';

export const KnowledgeAdmin: React.FC = () => {
  const { words } = useCircleWords();
  const index = useKnowledge().data;
  // What the last batch of a run here left; before any run, the index says.
  const [left, setLeft] = useState<number | null>(null);
  const [running, setRunning] = useState<{ start: number; read: number; personas: number } | null>(
    null,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useRef(false);
  const unread = left ?? index?.unread ?? null;
  const builtAt = index?.builtAt ?? null;

  // Leaving the page stops a run between batches.
  useEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, []);

  const build = useBuildKnowledge({
    onBatch: (r) => {
      setLeft(r.left);
      setRunning(
        (at) => at && { ...at, read: at.read + r.read, personas: at.personas + r.personas },
      );
    },
    stopped: () => stop.current,
  });

  const run = async () => {
    setProblem(null);
    setRunning({ start: unread ?? 0, read: 0, personas: 0 });
    try {
      await build.mutateAsync();
    } catch (e) {
      setProblem(
        e instanceof ApiError ? e.message : 'The index stopped partway. Run it again to carry on.',
      );
    } finally {
      setRunning(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1, mb: 1 }}>
        <HubIcon sx={{ color: 'primary.main' }} />
        <Typography sx={{ fontWeight: 700, flex: 1 }}>{capitalized(words.whose)} index</Typography>
        <Button variant="contained" onClick={run} disabled={!!running || unread === 0}>
          {running ? 'Reading…' : unread ? `Read ${unread} new answers` : 'Up to date'}
        </Button>
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        Notes what each person talks about, writes their persona, and finds what {words.circle}{' '}
        shares. It leaves out anyone who asked not to be named. Each answer is read once.
        {builtAt && !running && ` Last run ${new Date(builtAt).toLocaleDateString()}.`}
      </Typography>
      {running && running.start > 0 && (
        <Stack spacing={0.5} sx={{ mt: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (running.read / running.start) * 100)}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {running.read} of {running.start} read · {running.personas} personas written
          </Typography>
        </Stack>
      )}
      {problem && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          {problem}
        </Alert>
      )}
    </Paper>
  );
};
