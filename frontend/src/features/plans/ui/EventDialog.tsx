/**
 * One event (docs/decisions/0036): when and where, who it's for, going,
 * maybe or can't with how many you bring, everyone's answers, the talk
 * about it, and a way into your own calendar.
 */
import { type Drop, eventIcs, icsFileName, type Rsvp } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { type ReactNode, useEffect, useState } from 'react';
import { Face } from '../../../entities/person';
import { saveFile } from '../../../shared/lib/saveFile';
import { getUserColor, getUserInitials } from '../../../utils';
import { CommentsThread } from '../../comments';
import type { EventView, RsvpBody } from '../api/plansApi';
import { toInput } from '../model/eventDraft';
import { repeatText, shortDay, whenText } from '../model/eventText';
import { useEvent, useRsvp, useSaveEvent } from '../model/usePlans';

const ANSWERS: { value: Rsvp; label: string }[] = [
  { value: 'in', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'out', label: "Can't" },
];

/** Into the phone's or computer's own calendar: a file it opens. */
const addToCalendar = (d: Drop) =>
  saveFile(new Blob([eventIcs(d)], { type: 'text/calendar' }), icsFileName(d));

export interface EventDialogViewProps {
  open: boolean;
  me: string;
  nameOf: (id: string) => string;
  /** Undefined while it loads. */
  view: EventView | undefined;
  /** The day it was opened from, for a repeating event. */
  day?: string;
  onClose: () => void;
  onRsvp: (answer: Omit<RsvpBody, 'id'>) => Promise<void>;
  onEdit: () => void;
  /** Cancel the whole event, or skip one day of a repeating one. */
  onCancel: () => Promise<void>;
  onSkip: (day: string) => Promise<void>;
  onAddToCalendar: (d: Drop) => void;
  /** The comments, below the answers. */
  comments?: ReactNode;
}

const Line: React.FC<{ icon: ReactNode; children: ReactNode }> = ({ icon, children }) => (
  <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', color: 'text.secondary' }}>
    <Box sx={{ mt: '2px', display: 'flex' }}>{icon}</Box>
    <Typography variant="body2" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
      {children}
    </Typography>
  </Stack>
);

/** Who said what, grouped by answer. */
const Answers: React.FC<{
  rsvps: EventView['rsvps'];
  me: string;
  nameOf: (id: string) => string;
}> = ({ rsvps, me, nameOf }) => {
  const entries = Object.entries(rsvps);
  if (!entries.length)
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        No answers yet.
      </Typography>
    );
  return (
    <Stack spacing={1.25}>
      {ANSWERS.map(({ value, label }) => {
        const who = entries.filter(([, r]) => r.answer === value);
        if (!who.length) return null;
        const guests = who.reduce((n, [, r]) => n + (r.guests ?? 0), 0);
        return (
          <Box key={value}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
              {label} · {who.length}
              {guests ? ` + ${guests} guest${guests === 1 ? '' : 's'}` : ''}
            </Typography>
            <Stack spacing={0.75} sx={{ mt: 0.5 }}>
              {who.map(([id, r]) => (
                <Stack key={id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Face id={id} name={nameOf(id)} size={26} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {id === me ? 'You' : nameOf(id)}
                    {r.guests ? ` +${r.guests}` : ''}
                  </Typography>
                  {r.note && (
                    <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 0 }}>
                      {r.note}
                    </Typography>
                  )}
                </Stack>
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};

/** Your answer: going, maybe or can't, how many you bring, and a word. */
const YourAnswer: React.FC<{
  mine: EventView['rsvps'][string] | undefined;
  disabled: boolean;
  onRsvp: EventDialogViewProps['onRsvp'];
}> = ({ mine, disabled, onRsvp }) => {
  const [guests, setGuests] = useState(mine?.guests ?? 0);
  const [note, setNote] = useState(mine?.note ?? '');
  useEffect(() => {
    setGuests(mine?.guests ?? 0);
    setNote(mine?.note ?? '');
  }, [mine?.guests, mine?.note]);
  const answer = mine?.answer ?? null;
  const send = (a: Rsvp | null, g = guests, n = note) =>
    void onRsvp(a ? { answer: a, guests: g, note: n.trim() || undefined } : { answer: null });
  return (
    <Stack spacing={1.25}>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        color="primary"
        value={answer}
        disabled={disabled}
        onChange={(_e, a: Rsvp | null) => send(a)}
        aria-label="Your answer"
      >
        {ANSWERS.map((a) => (
          <ToggleButton key={a.value} value={a.value} sx={{ fontWeight: 700 }}>
            {a.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {(answer === 'in' || answer === 'maybe') && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            Bringing {guests ? `${guests} more` : 'nobody else'}
          </Typography>
          <IconButton
            size="small"
            aria-label="One fewer guest"
            disabled={guests === 0}
            onClick={() => {
              setGuests(guests - 1);
              send(answer, guests - 1);
            }}
          >
            <RemoveRoundedIcon />
          </IconButton>
          <IconButton
            size="small"
            aria-label="One more guest"
            disabled={guests >= 20}
            onClick={() => {
              setGuests(guests + 1);
              send(answer, guests + 1);
            }}
          >
            <AddRoundedIcon />
          </IconButton>
        </Stack>
      )}
      {answer && (
        <TextField
          size="small"
          placeholder="A word for everyone (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (mine?.note ?? '') && send(answer)}
          slotProps={{ htmlInput: { maxLength: 200, 'aria-label': 'A word with your answer' } }}
        />
      )}
    </Stack>
  );
};

export const EventDialogView: React.FC<EventDialogViewProps> = ({
  open,
  me,
  nameOf,
  view,
  day,
  onClose,
  onRsvp,
  onEdit,
  onCancel,
  onSkip,
  onAddToCalendar,
  comments,
}) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [confirming, setConfirming] = useState(false);
  const d = view?.event;
  return (
    <Dialog open={open} onClose={onClose} fullScreen={phone} fullWidth maxWidth="sm">
      <Stack direction="row" sx={{ alignItems: 'center', px: 2.5, pt: 2 }}>
        <Typography
          variant="h6"
          component="h2"
          sx={{ flex: 1, fontWeight: 800, textDecoration: d?.cancelled ? 'line-through' : 'none' }}
        >
          {d?.title ?? <Skeleton width="60%" />}
        </Typography>
        <IconButton aria-label="Close" onClick={onClose} edge="end">
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
      <DialogContent sx={{ pt: 1 }}>
        {!view || !d ? (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={24} />
            <Skeleton variant="rounded" height={80} />
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Face id={d.by} name={nameOf(d.by)} size={28} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {d.by === me ? 'Your event' : `${nameOf(d.by)}'s event`}
              </Typography>
              {d.from && <Chip size="small" label={`From ${d.from.name}`} />}
              {d.cancelled && <Chip size="small" color="error" label="Cancelled" />}
            </Stack>
            <Stack spacing={1}>
              <Line icon={<EventRoundedIcon fontSize="small" />}>{whenText(d, day)}</Line>
              {d.weekly && (
                <Line icon={<RepeatRoundedIcon fontSize="small" />}>
                  {repeatText(d.weekly, d.start)}
                </Line>
              )}
              {d.place && <Line icon={<PlaceRoundedIcon fontSize="small" />}>{d.place}</Line>}
              {d.details && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {d.details}
                </Typography>
              )}
            </Stack>

            <Box>
              <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                Invited here · {view.invited.length}
              </Typography>
              <Stack direction="row" spacing={-0.75} sx={{ mt: 0.5 }}>
                {view.invited.slice(0, 10).map((id) => (
                  <Face key={id} id={id} name={nameOf(id)} size={28} ring />
                ))}
              </Stack>
            </Box>

            {d.by !== me && (
              <YourAnswer mine={view.rsvps[me]} disabled={!!d.cancelled} onRsvp={onRsvp} />
            )}
            <Answers rsvps={view.rsvps} me={me} nameOf={nameOf} />
            {view.elsewhere.map((e) => (
              <Typography key={e.name} variant="body2" sx={{ color: 'text.secondary' }}>
                {e.name}: {e.in} going{e.guests ? ` + ${e.guests}` : ''}, {e.maybe} maybe
              </Typography>
            ))}

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
              <Button variant="contained" onClick={() => onAddToCalendar(d)}>
                Add to calendar
              </Button>
              {view.canEdit && (
                <Button variant="outlined" onClick={onEdit}>
                  Edit
                </Button>
              )}
              {view.canEdit && d.weekly && day && !d.cancelled && (
                <Button color="inherit" onClick={() => void onSkip(day)}>
                  Skip {shortDay(day)}
                </Button>
              )}
              {view.canEdit && !d.cancelled && (
                <Button
                  color="error"
                  onClick={() => (confirming ? void onCancel() : setConfirming(true))}
                >
                  {confirming ? 'Yes, cancel it' : 'Cancel event'}
                </Button>
              )}
            </Stack>

            {comments && (
              <>
                <Divider />
                {comments}
              </>
            )}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** The event's page, from the server: answers and changes save at once. */
export const EventDialog: React.FC<{
  id: string | null;
  day?: string;
  me: string;
  nameOf: (id: string) => string;
  onClose: () => void;
  onEdit: (event: Drop) => void;
}> = ({ id, day, me, nameOf, onClose, onEdit }) => {
  const { data: view } = useEvent(id);
  const rsvp = useRsvp();
  const save = useSaveEvent();
  const d = view?.event;
  return (
    <EventDialogView
      open={!!id}
      me={me}
      nameOf={nameOf}
      view={view}
      day={day}
      onClose={onClose}
      onRsvp={(answer) => rsvp({ ...answer, id: id ?? '' })}
      onEdit={() => d && onEdit(d)}
      onCancel={async () => {
        if (d) await save({ ...toInput(d), cancelled: true }, d.id);
      }}
      onSkip={async (skipped) => {
        if (d) await save({ ...toInput(d), skip: [...(d.skip ?? []), skipped] }, d.id);
      }}
      onAddToCalendar={addToCalendar}
      comments={
        id && (
          <CommentsThread
            contentId={id}
            contentType="event"
            currentUserId={me}
            getUserColor={getUserColor}
            getUserInitials={getUserInitials}
            textOverrides={{ placeholderText: 'Say something about it...' }}
          />
        )
      }
    />
  );
};
