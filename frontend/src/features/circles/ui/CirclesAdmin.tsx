import type { Circle } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MergeRoundedIcon from '@mui/icons-material/MergeRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { KIND_ICON, KIND_LABEL } from '../../../entities/circle';
import { problemOf } from '../../../shared/admin-ui';
import { enterCircle } from '../../../shared/session/session';
import type { SameSuggestion } from '../api/circlesApi';
import {
  useAllCircles,
  useAnswerSame,
  useJoinCircles,
  useSameSuggestions,
  useSplitCircle,
  useStartCircle,
} from '../model/circles';
import { CircleFields, isReady, type NewCircle, newCircle } from './CircleFields';
import { InviteButton } from './InviteButton';

interface Props {
  /** The circle open now. */
  currentId: string;
  /** What to call the owner in a new circle, to start with. */
  yourName: string;
}

/**
 * Admin › Circles for the deployment's owner: every circle, starting a new
 * one (a family, friends, or both) with its own theme, and joining circles
 * into one and splitting them again (docs/decisions/0018). Others see nothing.
 */
export const CirclesAdmin: React.FC<Props> = ({ currentId, yourName }) => {
  const circles = useAllCircles().data ?? null;
  const joiningAgain = useJoinCircles();
  const split = useSplitCircle();
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [splitting, setSplitting] = useState<Circle | null>(null);
  const [answering, setAnswering] = useState<Circle | null>(null);

  if (!circles) return null;
  const nameOf = (id: string) => circles.find((c) => c.id === id)?.name ?? id;
  const joinable = circles.filter((c) => !c.sources);
  const joinAgain = (c: Circle) => joiningAgain.mutate({ name: c.name, sources: c.sources ?? [] });
  const problem = joiningAgain.error
    ? joiningAgain.error.message || "Couldn't join them again."
    : problemOf(split.error);
  return (
    <Card sx={{ p: 2.5, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flex: 1, minWidth: 140 }}>
          Your circles
        </Typography>
        {joinable.length > 1 && (
          <Button startIcon={<MergeRoundedIcon />} onClick={() => setJoining(true)}>
            Join circles
          </Button>
        )}
        <Button startIcon={<AddRoundedIcon />} onClick={() => setStarting(true)}>
          Start a circle
        </Button>
      </Box>
      {problem && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {problem}
        </Alert>
      )}
      <Stack spacing={1}>
        {circles.map((c) => {
          const Icon = KIND_ICON[c.kind];
          return (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Icon sx={{ color: 'text.secondary' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 600 }}>{c.name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                  {c.sources ? `Joins ${c.sources.map(nameOf).join(' and ')}` : KIND_LABEL[c.kind]}
                  {c.id === currentId && ' · you are here'}
                </Typography>
              </Box>
              {c.endedAt ? (
                <>
                  <Chip size="small" label="Split" />
                  <Button size="small" onClick={() => joinAgain(c)}>
                    Join again
                  </Button>
                </>
              ) : c.sources ? (
                <>
                  <MightBeSame circle={c} onOpen={() => setAnswering(c)} />
                  <Button size="small" color="inherit" onClick={() => setSplitting(c)}>
                    Split
                  </Button>
                </>
              ) : (
                <InviteButton circleId={c.id} circleName={c.name} />
              )}
            </Box>
          );
        })}
      </Stack>
      <StartCircle open={starting} yourName={yourName} onClose={() => setStarting(false)} />
      {joining && <JoinCirclesDialog circles={joinable} onClose={() => setJoining(false)} />}
      {answering && <AnswerSame circle={answering} onClose={() => setAnswering(null)} />}
      {splitting && (
        <SplitDialog
          circle={splitting}
          sourceNames={(splitting.sources ?? []).map(nameOf)}
          onClose={() => setSplitting(null)}
          onSplit={() =>
            // Closed either way: a failure shows above the list.
            split.mutateAsync(splitting.id).then(
              () => setSplitting(null),
              () => setSplitting(null),
            )
          }
        />
      )}
    </Card>
  );
};

/** In a joined circle that hasn't ended: how many might be one person, to answer. */
const MightBeSame: React.FC<{ circle: Circle; onOpen: () => void }> = ({ circle, onOpen }) => {
  const count = useSameSuggestions(circle.id, true).data?.length ?? 0;
  if (count === 0) return null;
  return (
    <Chip
      size="small"
      color="primary"
      variant="outlined"
      label={`${count} might be the same person`}
      onClick={onOpen}
    />
  );
};

/** The suggestions for one joined circle; closes when none are left. */
const AnswerSame: React.FC<{ circle: Circle; onClose: () => void }> = ({ circle, onClose }) => {
  const suggestions = useSameSuggestions(circle.id, true).data ?? [];
  const answer = useAnswerSame(circle.id);
  return (
    <SamePersonDialog
      suggestions={suggestions}
      onAnswer={async (s, same) => {
        const left = await answer.mutateAsync({ s, same });
        if (!left.suggestions.length) onClose();
      }}
      onClose={onClose}
    />
  );
};

/** Pick two or more circles and a name: everyone plays together, nothing is copied. */
export const JoinCirclesDialog: React.FC<{
  circles: Circle[];
  onClose: () => void;
}> = ({ circles, onClose }) => {
  const joining = useJoinCircles();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const busy = joining.isPending;
  const made = joining.data ?? null;
  const error = joining.error
    ? joining.error.message || "Couldn't join them. Please try again."
    : null;
  const names = circles.filter((c) => picked.includes(c.id)).map((c) => c.name);

  const join = () => joining.mutate({ name: name.trim(), sources: picked });

  if (made) {
    const mine = made.circles.find((c) => c.id === made.circle.id);
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>{made.circle.name} is ready</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary' }}>
            Everyone in {names.join(' and ')} can open it from their circle menu. Season 1 has
            started.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Stay here</Button>
          <Button
            variant="outlined"
            onClick={() => (mine ? enterCircle(mine, made.circles) : window.location.assign('/'))}
          >
            Open {made.circle.name}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Join circles</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.secondary', mb: 1.5 }}>
          Everyone in them plays together in one more circle, with its own seasons. People and how
          they're connected come from the circles they're in, so nothing is copied, and splitting
          later loses nothing.
        </Typography>
        <Stack>
          {circles.map((c) => (
            <FormControlLabel
              key={c.id}
              label={c.name}
              control={
                <Checkbox
                  checked={picked.includes(c.id)}
                  onChange={(e) =>
                    setPicked((p) =>
                      e.target.checked ? [...p, c.id] : p.filter((x) => x !== c.id),
                    )
                  }
                />
              }
            />
          ))}
        </Stack>
        <TextField
          fullWidth
          size="small"
          label="Name"
          placeholder={names.join(' + ') || 'Everyone'}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 60))}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ mt: 2 }}
        />
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={busy || picked.length < 2} onClick={join}>
          Join them
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * People with the same name in two joined circles, and no sign-in to tell
 * them apart: one tap each says whether they're one person here.
 */
export const SamePersonDialog: React.FC<{
  suggestions: SameSuggestion[];
  onAnswer: (s: SameSuggestion, same: boolean) => Promise<void>;
  onClose: () => void;
}> = ({ suggestions, onAnswer, onClose }) => {
  const [busy, setBusy] = useState(false);
  const answer = (s: SameSuggestion, same: boolean) => {
    setBusy(true);
    void onAnswer(s, same).finally(() => setBusy(false));
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>The same person?</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          The same name comes up in two circles. If it's one person, they show once here, with
          everyone they're connected to. Nothing changes in either circle.
        </Typography>
        <Stack spacing={2}>
          {suggestions.map((s) => (
            <Box key={`${s.a.circleId}${s.a.id}${s.b.circleId}${s.b.id}`}>
              <Typography sx={{ fontWeight: 700 }}>{s.a.name}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75 }}>
                in {s.a.circleName} and in {s.b.circleName}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={busy}
                  onClick={() => answer(s, true)}
                >
                  Same person
                </Button>
                <Button size="small" disabled={busy} onClick={() => answer(s, false)}>
                  Not the same
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Later</Button>
      </DialogActions>
    </Dialog>
  );
};

/** Splitting ends the joined circle; everything in it is kept. */
const SplitDialog: React.FC<{
  circle: Circle;
  sourceNames: string[];
  onClose: () => void;
  onSplit: () => Promise<void>;
}> = ({ circle, sourceNames, onClose, onSplit }) => {
  const [busy, setBusy] = useState(false);
  const split = () => {
    setBusy(true);
    void onSplit().finally(() => setBusy(false));
  };
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontWeight: 700 }}>Split {circle.name}?</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'text.secondary' }}>
          Its season pauses and nothing is deleted: its answers stay, and{' '}
          {sourceNames.join(' and ')} carry on as they are. Join them again any time to pick up
          where you left off.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="warning" disabled={busy} onClick={split}>
          Split
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const StartCircle: React.FC<{ open: boolean; yourName: string; onClose: () => void }> = ({
  open,
  yourName,
  onClose,
}) => {
  const [form, setForm] = useState<NewCircle>(newCircle(yourName));
  const starting = useStartCircle();
  const busy = starting.isPending;
  const error = starting.isError ? "Couldn't start the circle. Please try again." : null;
  const made = starting.data ?? null;

  const start = () => starting.mutate(form);

  // Open the new circle; if this browser's list hasn't caught up, a fresh start finds it.
  const openIt = () => {
    const mine = made?.circles.find((c) => c.id === made.circle.id);
    if (mine && made) enterCircle(mine, made.circles);
    else window.location.assign('/');
  };

  if (made)
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>{made.circle.name} is ready</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'text.secondary', mb: 2 }}>
            Season 1 has started. Send a link to the people you want in it: they sign in with Google
            and they're in.
          </Typography>
          <InviteButton
            circleId={made.circle.id}
            circleName={made.circle.name}
            label="Share an invite link"
            variant="contained"
            size="large"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Stay here</Button>
          <Button variant="outlined" onClick={openIt}>
            Open {made.circle.name}
          </Button>
        </DialogActions>
      </Dialog>
    );

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
        <Button variant="contained" disabled={busy || !isReady(form)} onClick={start}>
          Start and open it
        </Button>
      </DialogActions>
    </Dialog>
  );
};
