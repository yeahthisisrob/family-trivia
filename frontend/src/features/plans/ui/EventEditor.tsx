/**
 * Make or change an event in one sheet (after Herd's EventEditor,
 * docs/decisions/0036): what it is, when (a day, a time, all day), whether
 * it repeats and on which days, where, anything to know, and who it's for,
 * as circles and people to tap.
 */
import { type Drop, WEEKDAYS } from '@family-trivia/shared';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { ChipRow, ChoiceChip, Field, PersonChip, Sheet } from '../../../shared/design-system';
import type { AudienceChoice, EventInput } from '../api/plansApi';
import { type Draft, draftOf, inputOf } from '../model/eventDraft';
import { dayLabel, repeatText, shortDay } from '../model/eventText';
import { useAudience, useSaveEvent } from '../model/usePlans';

export interface EventEditorViewProps {
  open: boolean;
  /** The event (or a drop-in plan) being changed; none for a new one. */
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

/** One circle: tap it in or out; in, everyone there or the people tapped. */
const CircleChoice: React.FC<{
  circle: AudienceChoice;
  chosen: string[] | null | undefined;
  onChange: (next: string[] | null | undefined) => void;
}> = ({ circle, chosen, onChange }) => {
  const on = chosen !== undefined;
  const others = circle.people.filter((p) => p.id !== circle.me);
  return (
    <Stack spacing={1}>
      <ChipRow>
        <ChoiceChip on={on} onClick={() => onChange(on ? undefined : null)}>
          {circle.name}
        </ChoiceChip>
      </ChipRow>
      {on && (
        <Box sx={{ pl: 1.5, borderLeft: 2, borderColor: 'divider' }}>
          <ChipRow label={`Who in ${circle.name}`}>
            <ChoiceChip dense on={chosen === null} onClick={() => onChange(null)}>
              Everyone
            </ChoiceChip>
            {others.map((p) => {
              const picked = !!chosen?.includes(p.id);
              return (
                <PersonChip
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  on={picked}
                  onClick={() => {
                    const now = chosen ?? [];
                    const next = picked ? now.filter((x) => x !== p.id) : [...now, p.id];
                    onChange(next.length ? next : null);
                  }}
                />
              );
            })}
          </ChipRow>
        </Box>
      )}
    </Stack>
  );
};

export const EventEditorView: React.FC<EventEditorViewProps> = ({
  open,
  editing,
  date,
  circles,
  canSetAudience,
  onSave,
  onClose,
}) => {
  const here = circles?.[0]?.circleId ?? '';
  const [draft, setDraft] = useState<Draft>(() => draftOf(here, date, editing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A fresh sheet each time it opens, and once the circles arrive.
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
  const weekday = WEEKDAYS[(new Date(`${draft.date}T12:00:00`).getDay() + 6) % 7];

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
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Edit' : 'New event'}
      actions={
        <>
          {!draft.allDay && (
            <Typography variant="caption" sx={{ color: 'text.secondary', flex: 1 }}>
              Times in {draft.zone.replace(/_/g, ' ')}
            </Typography>
          )}
          <Button onClick={onClose} color="inherit" sx={{ ml: 'auto' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!ready || busy}
            onClick={() => void save()}
            sx={{ minWidth: 96 }}
          >
            {editing ? 'Save' : 'Share it'}
          </Button>
        </>
      }
    >
      <Stack spacing={2.25} sx={{ pt: 0.5, pb: 1 }}>
        <TextField
          placeholder="What is it?"
          value={draft.title}
          onChange={(e) => set({ title: e.target.value })}
          slotProps={{
            htmlInput: {
              maxLength: 80,
              'aria-label': 'What is it?',
              style: { fontSize: 20, fontWeight: 700 },
            },
          }}
          autoFocus
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <Field label={draft.repeats ? 'Starts' : 'Day'}>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={draft.date}
              onChange={(e) => set({ date: e.target.value })}
              slotProps={{ htmlInput: { 'aria-label': 'Day' } }}
            />
          </Field>
          {!draft.allDay && (
            <Field label="Time">
              <TextField
                fullWidth
                size="small"
                type="time"
                value={draft.start}
                onChange={(e) => set({ start: e.target.value })}
                slotProps={{ htmlInput: { 'aria-label': 'Time' } }}
              />
            </Field>
          )}
          {!draft.allDay && (
            <Field label="Ends (optional)">
              <TextField
                fullWidth
                size="small"
                type="time"
                value={draft.end}
                onChange={(e) => set({ end: e.target.value })}
                slotProps={{ htmlInput: { 'aria-label': 'Ends' } }}
              />
            </Field>
          )}
        </Box>
        <ChipRow>
          <ChoiceChip on={draft.allDay} onClick={() => set({ allDay: !draft.allDay })}>
            All day
          </ChoiceChip>
        </ChipRow>

        <Field label="Repeats">
          <ChipRow label="Repeats">
            <ChoiceChip on={!draft.repeats} onClick={() => set({ repeats: false })}>
              Once
            </ChoiceChip>
            <ChoiceChip
              on={draft.repeats}
              onClick={() =>
                set({
                  repeats: true,
                  days: draft.days.length ? draft.days : weekday ? [weekday] : [],
                })
              }
            >
              <RepeatRoundedIcon /> Weekly
            </ChoiceChip>
          </ChipRow>
          {draft.repeats && (
            <Stack
              spacing={1.5}
              sx={{ mt: 1.25, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}
            >
              <ChipRow label="On">
                {WEEKDAYS.map((d) => {
                  const on = draft.days.includes(d);
                  return (
                    <ChoiceChip
                      key={d}
                      dense
                      on={on}
                      onClick={() => {
                        const days = on ? draft.days.filter((x) => x !== d) : [...draft.days, d];
                        if (days.length) set({ days });
                      }}
                    >
                      {dayLabel(d)}
                    </ChoiceChip>
                  );
                })}
              </ChipRow>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Field label="Every">
                  <TextField
                    select
                    fullWidth
                    size="small"
                    value={draft.every}
                    onChange={(e) => set({ every: Number(e.target.value) })}
                    slotProps={{ htmlInput: { 'aria-label': 'Every' } }}
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <MenuItem key={n} value={n}>
                        {n === 1 ? 'week' : `${n} weeks`}
                      </MenuItem>
                    ))}
                  </TextField>
                </Field>
                <Field label="Until">
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    value={draft.until}
                    onChange={(e) => set({ until: e.target.value })}
                    slotProps={{ htmlInput: { 'aria-label': 'Until', min: draft.date } }}
                  />
                </Field>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {repeatText(
                  {
                    days: draft.days,
                    every: draft.every,
                    ...(draft.until ? { until: draft.until } : {}),
                  },
                  draft.date,
                )}
                {draft.until ? '' : ', until you stop it'} · first on {shortDay(draft.date)}
              </Typography>
            </Stack>
          )}
        </Field>

        <Field label="Where">
          <TextField
            fullWidth
            size="small"
            placeholder="Optional"
            value={draft.place}
            onChange={(e) => set({ place: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 200, 'aria-label': 'Where' } }}
          />
        </Field>

        {canSetAudience && (
          <Field label="Who it's for">
            <Stack spacing={1.25}>
              {(circles ?? []).map((c) => (
                <CircleChoice
                  key={c.circleId}
                  circle={c}
                  chosen={draft.audience[c.circleId]}
                  onChange={(next) => setCircle(c.circleId, next)}
                />
              ))}
            </Stack>
          </Field>
        )}

        <Field label="Anything to know">
          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder="Anyone can come and watch"
            value={draft.details}
            onChange={(e) => set({ details: e.target.value })}
            slotProps={{ htmlInput: { maxLength: 2000, 'aria-label': 'Anything to know' } }}
          />
        </Field>
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Sheet>
  );
};

/** The editor, with the caller's circles from the server; saving refreshes the calendar. */
export const EventEditor: React.FC<{
  open: boolean;
  me: string;
  date: string;
  editing?: Drop;
  onClose: () => void;
}> = ({ open, me, date, editing, onClose }) => {
  const { data: circles } = useAudience(open);
  const save = useSaveEvent();
  return (
    <EventEditorView
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
