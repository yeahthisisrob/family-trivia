/**
 * Make or change an event (docs/decisions/0036): what, when, where, whether
 * it repeats each week, and who it's for: everyone here, chosen people, and
 * any other circle you're in.
 */
import { type Drop, WEEKDAYS, type Weekday } from '@family-trivia/shared';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { useEffect, useState } from 'react';
import type { AudienceChoice, EventInput } from '../api/plansApi';
import { type Draft, draftOf, inputOf } from '../model/eventDraft';
import { dayLabel } from '../model/eventText';
import { useAudience, useSaveEvent } from '../model/usePlans';

export interface EventFormViewProps {
  open: boolean;
  /** The event being changed; none for a new one. */
  editing?: Drop;
  /** The day a new event starts on. */
  date: string;
  /** The caller's circles, this one first; undefined while they load. */
  circles: AudienceChoice[] | undefined;
  /** Only its creator says who it's for. */
  canSetAudience: boolean;
  onSave: (input: EventInput) => Promise<void>;
  onClose: () => void;
}

/** One circle in the audience: all of it, or the people chosen. */
const CircleChoice: React.FC<{
  circle: AudienceChoice;
  chosen: string[] | null | undefined;
  onChange: (next: string[] | null | undefined) => void;
}> = ({ circle, chosen, onChange }) => {
  const on = chosen !== undefined;
  const others = circle.people.filter((p) => p.id !== circle.me);
  return (
    <Box>
      <FormControlLabel
        control={
          <Checkbox checked={on} onChange={(e) => onChange(e.target.checked ? null : undefined)} />
        }
        label={<Typography sx={{ fontWeight: 700 }}>{circle.name}</Typography>}
      />
      {on && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, pl: 4 }}>
          <Chip
            label="Everyone"
            color={chosen === null ? 'primary' : 'default'}
            variant={chosen === null ? 'filled' : 'outlined'}
            onClick={() => onChange(null)}
          />
          {others.map((p) => {
            const picked = !!chosen?.includes(p.id);
            return (
              <Chip
                key={p.id}
                label={p.name}
                color={picked ? 'primary' : 'default'}
                variant={picked ? 'filled' : 'outlined'}
                onClick={() => {
                  const now = chosen ?? [];
                  const next = picked ? now.filter((x) => x !== p.id) : [...now, p.id];
                  onChange(next.length ? next : null);
                }}
              />
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export const EventFormView: React.FC<EventFormViewProps> = ({
  open,
  editing,
  date,
  circles,
  canSetAudience,
  onSave,
  onClose,
}) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const here = circles?.[0]?.circleId ?? '';
  const [draft, setDraft] = useState<Draft>(() => draftOf(here, date, editing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A new form each time it opens, and once the circles arrive.
  useEffect(() => {
    if (open) setDraft(draftOf(here, date, editing));
    setError(null);
  }, [open, here, date, editing]);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setCircle = (id: string, people: string[] | null | undefined) =>
    setDraft((d) => {
      const { [id]: _old, ...rest } = d.audience;
      return { ...d, audience: people === undefined ? rest : { ...rest, [id]: people } };
    });

  const ready = draft.title.trim() && draft.date && Object.keys(draft.audience).length > 0;
  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(inputOf(draft, here));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "It didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm">
      <Stack direction="row" sx={{ alignItems: 'center', px: 2.5, pt: 2 }}>
        <Typography variant="h6" component="h2" sx={{ flex: 1, fontWeight: 800 }}>
          {editing ? 'Change the event' : 'New event'}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} edge="end">
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            label="What"
            placeholder="Birthday dinner"
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            autoFocus
          />
          <TextField
            label={draft.repeats ? 'Starts' : 'Day'}
            type="date"
            value={draft.date}
            onChange={(e) => set({ date: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <FormControlLabel
            control={
              <Switch checked={draft.allDay} onChange={(e) => set({ allDay: e.target.checked })} />
            }
            label="All day"
          />
          {!draft.allDay && (
            <Stack direction="row" spacing={1.5}>
              <TextField
                label="From"
                type="time"
                value={draft.start}
                onChange={(e) => set({ start: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="To (optional)"
                type="time"
                value={draft.end}
                onChange={(e) => set({ end: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ flex: 1 }}
              />
            </Stack>
          )}
          <TextField
            label="Where (optional)"
            placeholder="Grandpa's house"
            value={draft.place}
            onChange={(e) => set({ place: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 200 } }}
          />
          <TextField
            label="Anything to know (optional)"
            placeholder="Anyone can come and watch"
            multiline
            minRows={2}
            value={draft.details}
            onChange={(e) => set({ details: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />

          <FormControlLabel
            control={
              <Switch
                checked={draft.repeats}
                onChange={(e) => set({ repeats: e.target.checked })}
              />
            }
            label="Repeats every week"
          />
          {draft.repeats && (
            <Stack spacing={1.5}>
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}
                role="group"
                aria-label="On"
              >
                {WEEKDAYS.map((d: Weekday) => {
                  const on = draft.days.includes(d);
                  return (
                    <Chip
                      key={d}
                      label={dayLabel(d)}
                      color={on ? 'primary' : 'default'}
                      variant={on ? 'filled' : 'outlined'}
                      aria-pressed={on}
                      onClick={() =>
                        set({ days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d] })
                      }
                    />
                  );
                })}
              </Box>
              <TextField
                label="Until (optional)"
                type="date"
                value={draft.until}
                onChange={(e) => set({ until: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                helperText={
                  draft.until ? undefined : 'Left empty, it keeps going until you stop it'
                }
              />
            </Stack>
          )}

          {canSetAudience && (
            <Box>
              <Typography sx={{ fontWeight: 800, mb: 0.5 }}>Who it's for</Typography>
              {(circles ?? []).map((c) => (
                <CircleChoice
                  key={c.circleId}
                  circle={c}
                  chosen={draft.audience[c.circleId]}
                  onChange={(next) => setCircle(c.circleId, next)}
                />
              ))}
            </Box>
          )}
          {!draft.allDay && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Times are in {draft.zone.replace(/_/g, ' ')}.
            </Typography>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button variant="contained" disabled={!ready || busy} onClick={() => void save()}>
          {editing ? 'Save' : 'Share it'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/** The form, with the caller's circles from the server; saving refreshes the weeks ahead. */
export const EventForm: React.FC<{
  open: boolean;
  me: string;
  date: string;
  editing?: Drop;
  onClose: () => void;
}> = ({ open, me, date, editing, onClose }) => {
  const { data: circles } = useAudience(open);
  const save = useSaveEvent();
  return (
    <EventFormView
      open={open}
      editing={editing}
      date={date}
      circles={circles}
      canSetAudience={!editing || editing.by === me}
      onSave={async (input) => {
        await save(input, editing?.id);
      }}
      onClose={onClose}
    />
  );
};
