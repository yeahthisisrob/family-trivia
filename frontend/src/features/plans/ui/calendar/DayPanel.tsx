/** The picked day (after Herd's DayBar): its date, its events, and a way to add one on it. */
import type { Drop, PlansView } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Button, Paper, Stack, Typography } from '@mui/material';
import type React from 'react';
import { EventRow } from './EventRow';

export const dayTitle = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

export const DayPanel: React.FC<{
  day: string;
  events: Drop[];
  rsvps: PlansView['rsvps'];
  me: string;
  nameOf: (id: string) => string;
  onOpen: (id: string, day: string) => void;
  onAdd: (day: string) => void;
  /** In a sheet the sheet says the day. */
  bare?: boolean;
}> = ({ day, events, rsvps, me, nameOf, onOpen, onAdd, bare }) => {
  const body = (
    <Stack spacing={1}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        {!bare && <Typography sx={{ fontWeight: 800, flex: 1 }}>{dayTitle(day)}</Typography>}
        <Button
          size="small"
          startIcon={<AddRoundedIcon />}
          onClick={() => onAdd(day)}
          sx={{ ml: 'auto' }}
        >
          Add on this day
        </Button>
      </Stack>
      {events.length ? (
        events.map((d) => (
          <EventRow
            key={d.id}
            drop={d}
            day={day}
            rsvps={rsvps[d.id] ?? {}}
            me={me}
            nameOf={nameOf}
            onOpen={onOpen}
          />
        ))
      ) : (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nothing on yet.
        </Typography>
      )}
    </Stack>
  );
  return bare ? (
    body
  ) : (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
      {body}
    </Paper>
  );
};
