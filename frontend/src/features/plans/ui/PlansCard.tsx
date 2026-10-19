/**
 * What's on (docs/decisions/0026): drop in what you're doing in a few words,
 * and see the next two weeks for everyone at a glance. Tap a day for who's
 * free, who's away and what's planned, and say you're in.
 */
import type { Drop, PlanDay, PlansView, Rsvp } from '@family-trivia/shared';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import {
  Box,
  Button,
  ButtonBase,
  Card,
  Chip,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type React from 'react';
import { useState } from 'react';
import { Face } from '../../../entities/person';
import { usePlans } from '../model/usePlans';

const EXAMPLES = [
  'Beach weekend, the 14th to the 16th',
  'Busy Tuesday nights',
  'Free Saturday, anyone up for a hike?',
];

const STRIP = 14;

const at = (d: string) => new Date(`${d}T12:00:00`);
const dayName = (d: string) =>
  at(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
const short = (d: string) =>
  at(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

interface ViewProps {
  me: string;
  nameOf: (id: string) => string;
  view: PlansView | null;
  onDropIn: (text: string) => Promise<Drop[]>;
  onRemove: (id: string) => Promise<void>;
  onRsvp: (id: string, answer: Rsvp | null) => Promise<void>;
}

const DayCell: React.FC<{ day: PlanDay; on: boolean; best: boolean; onClick: () => void }> = ({
  day,
  on,
  best,
  onClick,
}) => {
  const theme = useTheme();
  const d = at(day.date);
  return (
    <ButtonBase
      onClick={onClick}
      aria-pressed={on}
      aria-label={short(day.date)}
      sx={{
        flex: '0 0 auto',
        width: 46,
        py: 1,
        borderRadius: 2,
        flexDirection: 'column',
        gap: 0.25,
        bgcolor: on
          ? 'primary.main'
          : best
            ? alpha(theme.palette.success.main, 0.14)
            : 'background.paper',
        color: on ? 'primary.contrastText' : 'text.primary',
        border: 1,
        borderColor: on ? 'primary.main' : 'divider',
      }}
    >
      <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, opacity: 0.75 }}>
        {d.toLocaleDateString(undefined, { weekday: 'narrow' })}
      </Typography>
      <Typography sx={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1 }}>
        {d.getDate()}
      </Typography>
      <Stack direction="row" spacing={0.4} sx={{ height: 6, mt: 0.25 }}>
        {day.plans.length > 0 && <Dot color={on ? 'currentColor' : theme.palette.primary.main} />}
        {day.free.length > 0 && <Dot color={on ? 'currentColor' : theme.palette.success.main} />}
        {day.busy.length > 0 && <Dot color={on ? 'currentColor' : theme.palette.text.disabled} />}
      </Stack>
    </ButtonBase>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: color }} />
);

const People: React.FC<{ ids: string[]; nameOf: (id: string) => string }> = ({ ids, nameOf }) => (
  <Stack direction="row" spacing={-0.75}>
    {ids.slice(0, 6).map((id) => (
      <Face key={id} id={id} name={nameOf(id)} size={26} ring />
    ))}
  </Stack>
);

export const PlansCardView: React.FC<ViewProps> = ({
  me,
  nameOf,
  view,
  onDropIn,
  onRemove,
  onRsvp,
}) => {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<Drop[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const example = EXAMPLES[new Date().getDate() % EXAMPLES.length];

  if (!view) return null;
  const strip = view.days.slice(0, STRIP);
  const day = view.days.find((d) => d.date === (picked ?? view.best[0] ?? strip[0]?.date));
  const dropOf = (id: string) => view.drops.find((d) => d.id === id);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      setAdded(await onDropIn(text.trim()));
      setText('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card sx={{ p: 2.5, mb: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1.5 }}>
        <CalendarMonthRoundedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          What's on
        </Typography>
      </Stack>

      <TextField
        fullWidth
        size="small"
        placeholder={example}
        value={text}
        disabled={busy}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && void send()}
        slotProps={{
          htmlInput: { maxLength: 400, 'aria-label': "What you're doing" },
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label="Drop it in"
                  disabled={busy || !text.trim()}
                  onClick={() => void send()}
                  edge="end"
                >
                  <SendRoundedIcon />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
        Say it how you'd say it. Away times only show as busy.
      </Typography>

      {added && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}>
          {added.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              I couldn't find a day in that. Try adding when.
            </Typography>
          ) : (
            added.map((d) => (
              <Chip
                key={d.id}
                color="primary"
                variant="outlined"
                label={`${d.title} · ${short(d.start)}${d.end ? ` to ${short(d.end)}` : ''}${d.weekly ? ', weekly' : ''}`}
                onDelete={() => {
                  void onRemove(d.id);
                  setAdded((a) => a?.filter((x) => x.id !== d.id) ?? null);
                }}
              />
            ))
          )}
        </Box>
      )}

      {view.best.length > 0 && (
        <Typography variant="body2" sx={{ mt: 2 }}>
          <Box component="span" sx={{ fontWeight: 700, color: 'success.main' }}>
            Good days to get together:
          </Box>{' '}
          {view.best.map(dayName).join(' · ')}
        </Typography>
      )}

      <Box
        sx={{ display: 'flex', gap: 0.75, overflowX: 'auto', mt: 1.5, pb: 0.5, mx: -0.5, px: 0.5 }}
      >
        {strip.map((d) => (
          <DayCell
            key={d.date}
            day={d}
            on={d.date === day?.date}
            best={view.best.includes(d.date)}
            onClick={() => setPicked(d.date)}
          />
        ))}
      </Box>

      {day && (
        <Stack spacing={1.25} sx={{ mt: 2 }}>
          <Typography sx={{ fontWeight: 700 }}>{short(day.date)}</Typography>
          {day.plans.map((id) => {
            const d = dropOf(id);
            if (!d) return null;
            const answers = view.rsvps[id] ?? {};
            const ins = Object.keys(answers).filter((u) => answers[u] === 'in');
            const mineIs = answers[me];
            const mine = d.by === me;
            return (
              <Box
                key={id}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: alpha(
                    d.kind === 'free' ? theme.palette.success.main : theme.palette.primary.main,
                    0.08,
                  ),
                }}
              >
                <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
                  <Face id={d.by} name={nameOf(d.by)} size={32} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {d.kind === 'free' ? `${nameOf(d.by)} is free` : d.title}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {d.kind === 'free' ? d.title : `${mine ? 'Your plan' : nameOf(d.by)}`}
                      {d.part && d.part !== 'all-day' ? ` · ${d.part}` : ''}
                      {ins.length ? ` · ${ins.length} in` : ''}
                    </Typography>
                  </Box>
                  {ins.length > 0 && <People ids={ins} nameOf={nameOf} />}
                </Stack>
                {!mine && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant={mineIs === 'in' ? 'contained' : 'outlined'}
                      onClick={() => void onRsvp(id, mineIs === 'in' ? null : 'in')}
                    >
                      I'm in
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      variant={mineIs === 'out' ? 'contained' : 'text'}
                      onClick={() => void onRsvp(id, mineIs === 'out' ? null : 'out')}
                    >
                      Can't
                    </Button>
                  </Stack>
                )}
              </Box>
            );
          })}
          {day.busy.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <People ids={day.busy} nameOf={nameOf} />
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {day.busy.map(nameOf).join(', ')} {day.busy.length === 1 ? 'is' : 'are'} busy
              </Typography>
            </Stack>
          )}
          {!day.plans.length && !day.busy.length && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Nothing on yet. Drop something in.
            </Typography>
          )}
        </Stack>
      )}
    </Card>
  );
};

/** Home's card: the circle's next weeks from the server. */
export const PlansCard: React.FC<{ me: string; nameOf: (id: string) => string }> = ({
  me,
  nameOf,
}) => {
  const { view, dropIn, remove, rsvp } = usePlans();
  return (
    <PlansCardView
      me={me}
      nameOf={nameOf}
      view={view}
      onDropIn={dropIn}
      onRemove={remove}
      onRsvp={rsvp}
    />
  );
};
