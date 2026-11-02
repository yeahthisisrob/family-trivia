/**
 * The agenda (after Herd's AgendaList): one card per day that has anything
 * on it, and today always, its date in a tile; each event a row to tap.
 */
import type { Drop, PlansView } from '@family-trivia/shared';
import { Box, ButtonBase, Paper, Stack, Typography } from '@mui/material';
import type React from 'react';
import { EventRow } from './EventRow';

const DayTile: React.FC<{ day: string; today: boolean; onClick?: () => void }> = ({
  day,
  today,
  onClick,
}) => {
  const at = new Date(`${day}T12:00:00`);
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={at.toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })}
      sx={{
        width: 52,
        flexShrink: 0,
        flexDirection: 'column',
        alignSelf: 'flex-start',
        borderRadius: 2,
        py: 0.5,
        bgcolor: today ? 'primary.main' : 'action.hover',
        color: today ? 'primary.contrastText' : 'text.primary',
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
        {at.toLocaleDateString(undefined, { weekday: 'short' })}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 800, lineHeight: 1.2 }}>
        {at.getDate()}
      </Typography>
    </ButtonBase>
  );
};

export const AgendaList: React.FC<{
  days: string[];
  today: string;
  events: Map<string, Drop[]>;
  rsvps: PlansView['rsvps'];
  me: string;
  nameOf: (id: string) => string;
  onPickDay: (day: string) => void;
  onOpen: (id: string, day: string) => void;
}> = ({ days, today, events, rsvps, me, nameOf, onPickDay, onOpen }) => {
  const rows = days.filter((d) => events.has(d) || d === today);
  if (!rows.some((d) => events.has(d)))
    return (
      <Typography variant="body2" sx={{ py: 3, textAlign: 'center', color: 'text.secondary' }}>
        Nothing on this month yet.
      </Typography>
    );
  return (
    <Stack spacing={1}>
      {rows.map((day) => (
        <Paper
          key={day}
          variant="outlined"
          sx={{
            display: 'flex',
            gap: 1.25,
            p: 1.25,
            borderRadius: 3,
            borderColor: day === today ? 'primary.main' : 'divider',
          }}
        >
          <DayTile day={day} today={day === today} onClick={() => onPickDay(day)} />
          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            {(events.get(day) ?? []).map((d) => (
              <EventRow
                key={d.id}
                drop={d}
                day={day}
                rsvps={rsvps[d.id] ?? {}}
                me={me}
                nameOf={nameOf}
                onOpen={onOpen}
              />
            ))}
            {!events.has(day) && (
              <Box sx={{ alignSelf: 'center', flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Nothing today
                </Typography>
              </Box>
            )}
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};
