import type { Circle, MyCircle } from '@family-trivia/shared';
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
import { useCallback, useEffect, useState } from 'react';
import { KIND_ICON, KIND_LABEL } from '../../../entities/circle';
import { enterCircle } from '../../../session';
import { circlesApi, type SameSuggestion } from '../api/circlesApi';
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
  const [circles, setCircles] = useState<Circle[] | null>(null);
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [splitting, setSplitting] = useState<Circle | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Joined circle → who might be the same person there.
  const [same, setSame] = useState<Record<string, SameSuggestion[]>>({});
  const [answering, setAnswering] = useState<Circle | null>(null);
  useEffect(() => {
    for (const c of circles ?? [])
      if (c.sources && !c.endedAt)
        circlesApi
          .same(c.id)
          .then((r) => setSame((m) => ({ ...m, [c.id]: r.suggestions })))
          .catch(() => undefined);
  }, [circles]);
  const reload = useCallback(
    () =>
      circlesApi
        .all()
        .then((r) => setCircles(r.owner ? r.circles : null))
        .catch(() => setCircles(null)),
    [],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!circles) return null;
  const nameOf = (id: string) => circles.find((c) => c.id === id)?.name ?? id;
  const joinable = circles.filter((c) => !c.sources);
  const joinAgain = async (c: Circle) => {
    setProblem(null);
    try {
      await circlesApi.joinCircles({ name: c.name, sources: c.sources ?? [] });
      await reload();
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Couldn't join them again.");
    }
  };
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
                  <Button size="small" onClick={() => void joinAgain(c)}>
                    Join again
                  </Button>
                </>
              ) : c.sources ? (
                <>
                  {(same[c.id]?.length ?? 0) > 0 && (
                    <Chip
                      size="small"
                      color="primary"
                      variant="outlined"
                      label={`${same[c.id]?.length} might be the same person`}
                      onClick={() => setAnswering(c)}
                    />
                  )}
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
      {joining && (
        <JoinCirclesDialog
          circles={joinable}
          onClose={() => setJoining(false)}
          onJoined={() => void reload()}
        />
      )}
      {answering && (
        <SamePersonDialog
          suggestions={same[answering.id] ?? []}
          onAnswer={async (s, isSame) => {
            const r = await circlesApi.answerSame(answering.id, s, isSame);
            setSame((m) => ({ ...m, [answering.id]: r.suggestions }));
            if (!r.suggestions.length) setAnswering(null);
          }}
          onClose={() => setAnswering(null)}
        />
      )}
      {splitting && (
        <SplitDialog
          circle={splitting}
          sourceNames={(splitting.sources ?? []).map(nameOf)}
          onClose={() => setSplitting(null)}
          onSplit={async () => {
            await circlesApi.split(splitting.id);
            setSplitting(null);
            await reload();
          }}
        />
      )}
    </Card>
  );
};

/** Pick two or more circles and a name: everyone plays together, nothing is copied. */
export const JoinCirclesDialog: React.FC<{
  circles: Circle[];
  onClose: () => void;
  onJoined: () => void;
}> = ({ circles, onClose, onJoined }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ circle: Circle; circles: MyCircle[] } | null>(null);
  const names = circles.filter((c) => picked.includes(c.id)).map((c) => c.name);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await circlesApi.joinCircles({ name: name.trim(), sources: picked });
      setMade(r);
      onJoined();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't join them. Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
        <Button
          variant="contained"
          disabled={busy || picked.length < 2}
          onClick={() => void join()}
        >
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
        <Button
          variant="contained"
          color="warning"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onSplit().finally(() => setBusy(false));
          }}
        >
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [made, setMade] = useState<{ circle: Circle; circles: MyCircle[] } | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      setMade(await circlesApi.create(form));
    } catch {
      setError("Couldn't start the circle. Please try again.");
    } finally {
      setBusy(false);
    }
  };

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
        <Button variant="contained" disabled={busy || !isReady(form)} onClick={() => void start()}>
          Start and open it
        </Button>
      </DialogActions>
    </Dialog>
  );
};
