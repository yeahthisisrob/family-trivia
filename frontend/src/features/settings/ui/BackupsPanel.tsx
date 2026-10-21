/**
 * Settings › Backups: when the family's data was last copied, the copies
 * kept, and a button to make one now (docs/decisions/0014).
 */
import BackupIcon from '@mui/icons-material/Backup';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { formatDistanceToNow } from 'date-fns';
import type React from 'react';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/ApiService';
import { useBackups, useMakeBackup } from '../model/backups';

const size = (b = 0) =>
  b > 1e9
    ? `${(b / 1e9).toFixed(1)} GB`
    : b > 1e6
      ? `${(b / 1e6).toFixed(1)} MB`
      : `${Math.max(1, Math.round(b / 1e3))} KB`;

export const BackupsPanel: React.FC = () => {
  const read = useBackups();
  const making = useMakeBackup();
  const view = read.data ?? null;
  const busy = making.isPending;
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [loadNoticeClosed, setLoadNoticeClosed] = useState(false);
  const notice =
    message ??
    (read.isError && !view && !loadNoticeClosed
      ? { tone: 'warning' as const, text: 'Backups didn’t load. Try again in a moment.' }
      : null);

  const make = () => {
    setMessage(null);
    making.mutate(undefined, {
      onSuccess: (run) =>
        setMessage({
          tone: 'success',
          text: `Backed up ${run.objects} files (${size(run.bytes)}), and checked.`,
        }),
      onError: (e) =>
        setMessage({
          tone: 'warning',
          text: e instanceof ApiError ? e.message : 'The backup didn’t finish.',
        }),
    });
  };

  const ok = view?.lastOk;
  const stale = ok ? Date.now() - new Date(ok.at).getTime() > 7 * 86_400_000 : true;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{ gap: 1.5, alignItems: { sm: 'center' } }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 700 }}>
            {ok
              ? `Last backed up ${formatDistanceToNow(new Date(ok.at), { addSuffix: true })}`
              : 'No backups yet'}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {ok
              ? `${ok.objects} files, ${size(ok.bytes)}, ${ok.trigger === 'automatic' ? 'made overnight' : 'made by hand'}. Every file was checked.`
              : 'A backup is a full, checked copy of every answer, fact, photo and game, kept apart from the app’s own storage.'}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<BackupIcon />}
          disabled={busy || view?.configured === false}
          onClick={make}
          sx={{ minHeight: 44, flexShrink: 0 }}
        >
          {busy ? 'Backing up…' : 'Back up now'}
        </Button>
      </Stack>

      {view?.configured === false && (
        <Alert severity="info" sx={{ mt: 1.5 }}>
          This deployment has no backups bucket yet. Deploy the latest infra to add one.
        </Alert>
      )}
      {view?.last && !view.last.ok && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          The last backup didn’t finish: {view.last.error}
        </Alert>
      )}
      {view?.configured && stale && !view.automatic && (
        <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
          It’s been a while. Back up now, or turn on nightly backups above.
        </Typography>
      )}
      {notice && (
        <Alert
          severity={notice.tone}
          sx={{ mt: 1.5 }}
          onClose={() => (message ? setMessage(null) : setLoadNoticeClosed(true))}
        >
          {notice.text}
        </Alert>
      )}

      {view && (view.snapshots.daily.length > 0 || view.snapshots.monthly.length > 0) && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Copies kept: daily ones for 35 days, the first of each month for good
          </Typography>
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
            {view.snapshots.monthly.map((m) => (
              <Chip
                key={`m${m}`}
                size="small"
                color="primary"
                variant="outlined"
                label={`${m} · kept`}
              />
            ))}
            {view.snapshots.daily.slice(0, 10).map((d) => (
              <Chip key={d} size="small" label={d} />
            ))}
          </Stack>
        </Box>
      )}
    </Paper>
  );
};
