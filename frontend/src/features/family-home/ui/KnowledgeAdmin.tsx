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
import { ApiError } from '../../../services/ApiService';
import { familyHomeApi } from '../api/familyHomeApi';

export const KnowledgeAdmin: React.FC = () => {
  const { words } = useCircleWords();
  const [unread, setUnread] = useState<number | null>(null);
  const [builtAt, setBuiltAt] = useState<string | null>(null);
  const [running, setRunning] = useState<{ start: number; read: number; personas: number } | null>(
    null,
  );
  const [problem, setProblem] = useState<string | null>(null);
  const stop = useRef(false);

  useEffect(() => {
    familyHomeApi
      .knowledge()
      .then((k) => {
        setUnread(k.unread);
        setBuiltAt(k.builtAt);
      })
      .catch(() => undefined);
    return () => {
      stop.current = true;
    };
  }, []);

  const run = async () => {
    setProblem(null);
    const start = unread ?? 0;
    let read = 0;
    let personas = 0;
    setRunning({ start, read, personas });
    try {
      for (let guard = 0; guard < 200 && !stop.current; guard++) {
        const r = await familyHomeApi.buildKnowledge();
        read += r.read;
        personas += r.personas;
        setUnread(r.left);
        setRunning({ start, read, personas });
        if (r.left === 0 || (r.read === 0 && r.personas === 0)) break;
      }
      setBuiltAt(new Date().toISOString());
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
