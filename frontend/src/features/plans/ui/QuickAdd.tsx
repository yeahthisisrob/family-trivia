/**
 * Add in a sentence (after Herd's QuickAdd): type it like you'd text it,
 * the same reader as What's on turns it into days, and each one comes back
 * to check: an event can open in the editor for the rest of its details.
 */
import type { Drop } from '@family-trivia/shared';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { Sheet } from '../../../shared/design-system';
import { whenText } from '../model/eventText';
import { useQuickAdd } from '../model/usePlans';

const EXAMPLES = [
  "Thursday 4:30 at Grandpa's",
  "Carol's birthday dinner Saturday at 6",
  'Gymnastics Tuesdays and Thursdays 5:30, anyone can watch',
  'Busy Friday night',
];

const KIND = { plan: 'Event', free: 'Free', busy: 'Busy' } as const;

export interface QuickAddViewProps {
  open: boolean;
  onClose: () => void;
  onAdd: (text: string) => Promise<Drop[]>;
  /** Open an added event in the editor. */
  onDetails: (drop: Drop) => void;
}

export const QuickAddView: React.FC<QuickAddViewProps> = ({ open, onClose, onAdd, onDetails }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Drop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setText('');
    setAdded(null);
    setError(null);
    onClose();
  };
  const go = async () => {
    if (text.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      setAdded(await onAdd(text.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        <>
          <AutoAwesomeRoundedIcon sx={{ color: 'primary.main' }} /> Add it in a sentence
        </>
      }
      actions={
        added ? (
          <>
            <Button color="inherit" onClick={() => setAdded(null)}>
              Add another
            </Button>
            <Button variant="contained" sx={{ ml: 'auto' }} onClick={close}>
              Done
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            sx={{ ml: 'auto', minWidth: 96 }}
            disabled={busy || text.trim().length < 2}
            onClick={() => void go()}
          >
            {busy ? 'Reading…' : 'Add'}
          </Button>
        )
      }
    >
      {!added ? (
        <Stack spacing={1.5}>
          <TextField
            multiline
            minRows={3}
            autoFocus
            placeholder="Type it like you'd text it…"
            value={text}
            disabled={busy}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void go();
            }}
            slotProps={{ htmlInput: { maxLength: 400, 'aria-label': 'What is happening' } }}
          />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {EXAMPLES.map((ex) => (
              <Chip
                key={ex}
                size="small"
                label={ex}
                onClick={() => setText(ex)}
                sx={{ bgcolor: 'action.hover' }}
              />
            ))}
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      ) : added.length === 0 ? (
        <Typography sx={{ color: 'text.secondary' }}>
          I couldn't find a day in that. Try saying when.
        </Typography>
      ) : (
        <Stack spacing={1}>
          {added.map((d) => (
            <Paper key={d.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                <Chip
                  size="small"
                  label={KIND[d.kind]}
                  color={d.kind === 'plan' ? 'primary' : 'default'}
                />
                <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                  {d.title}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                {whenText(d)}
                {d.place ? ` · ${d.place}` : ''}
              </Typography>
              {d.kind === 'plan' && (
                <Button size="small" sx={{ mt: 0.5, px: 0 }} onClick={() => onDetails(d)}>
                  Add details and who it's for
                </Button>
              )}
            </Paper>
          ))}
        </Stack>
      )}
    </Sheet>
  );
};

export const QuickAdd: React.FC<Omit<QuickAddViewProps, 'onAdd'>> = (props) => {
  const add = useQuickAdd();
  return <QuickAddView {...props} onAdd={add} />;
};
