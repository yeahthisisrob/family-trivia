/**
 * Download the family archive: everyone's memories, or chosen people's, as a
 * zip with one folder per person (answers, facts, games, comments).
 */
import DownloadIcon from '@mui/icons-material/Download';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useCircleWords } from '../../../entities/circle';
import { type ArchiveOptions, archiveApi } from '../api/archiveApi';

export const ArchiveDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { words } = useCircleWords();
  const [options, setOptions] = useState<ArchiveOptions | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    archiveApi
      .options()
      .then((o) => {
        setOptions(o);
        setChosen(new Set(o.people.map((p) => p.id)));
      })
      .catch(() => setError(`Couldn't load ${words.circle}. Try again in a moment.`));
  }, []);

  const toggle = (ids: string[], on: boolean) =>
    setChosen((c) => {
      const next = new Set(c);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const download = async () => {
    if (!options) return;
    setBusy(true);
    setError(null);
    try {
      const all = chosen.size === options.people.length;
      const res = await archiveApi.export(all ? 'all' : [...chosen]);
      window.location.assign(res.url);
      setDone(
        `Your download has started: ${res.people} ${res.people === 1 ? 'person' : 'people'}.`,
      );
    } catch {
      setError("The archive didn't build. Try again, or with fewer people.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Download {words.archive}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          A zip with a folder for each person: their trivia answers, their answers to the daily
          {words.noun} questions, games and comments. Everything opens in any app; nothing leaves
          your {words.noun}'s storage except this download.
        </Typography>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {done && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {done}
          </Alert>
        )}
        {options && !options.canExport && (
          <Alert severity="info">
            Downloading the archive is turned off for you. An admin can turn it on.
          </Alert>
        )}
        {options?.canExport && (
          <>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
              <Chip
                label="Everyone"
                color={chosen.size === options.people.length ? 'primary' : 'default'}
                onClick={() =>
                  toggle(
                    options.people.map((p) => p.id),
                    chosen.size !== options.people.length,
                  )
                }
              />
              {options.households.map((h) => {
                const all = h.members.length > 0 && h.members.every((m) => chosen.has(m));
                return (
                  <Chip
                    key={h.id}
                    label={h.name}
                    variant={all ? 'filled' : 'outlined'}
                    onClick={() => toggle(h.members, !all)}
                  />
                );
              })}
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
              {options.people.map((p) => (
                <FormControlLabel
                  key={p.id}
                  control={
                    <Checkbox
                      checked={chosen.has(p.id)}
                      onChange={(e) => toggle([p.id], e.target.checked)}
                    />
                  }
                  label={p.remembered ? `${p.name} (in memory)` : p.name}
                />
              ))}
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Close</Button>
        {options?.canExport && (
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={busy || chosen.size === 0}
            onClick={download}
          >
            {busy ? 'Building…' : `Download${chosen.size ? ` (${chosen.size})` : ''}`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
