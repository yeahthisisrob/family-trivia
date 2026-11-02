/**
 * One event on one day (after Herd's EventRow): its time, a bar in its
 * maker's color, the title, where, and who's coming. Tap for its page.
 */
import type { Drop, RsvpEntry } from '@family-trivia/shared';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import { Box, ButtonBase, Stack, Typography } from '@mui/material';
import type React from 'react';
import { Face } from '../../../../entities/person';
import { identityColor } from '../../../../shared/design-system';
import { clockText } from '../../model/eventText';
import { AttendanceLine } from '../Attendance';

export const EventRow: React.FC<{
  drop: Drop;
  day: string;
  rsvps: Record<string, RsvpEntry>;
  me: string;
  nameOf: (id: string) => string;
  onOpen: (id: string, day: string) => void;
}> = ({ drop: d, day, rsvps, me, nameOf, onOpen }) => (
  <ButtonBase
    onClick={() => onOpen(d.id, day)}
    aria-label={`${d.title}, details`}
    sx={{
      width: '100%',
      justifyContent: 'flex-start',
      alignItems: 'stretch',
      textAlign: 'left',
      gap: 1.25,
      p: 1.25,
      borderRadius: 2,
      border: 1,
      borderColor: 'divider',
      bgcolor: 'background.paper',
      opacity: d.cancelled ? 0.6 : 1,
      '&:hover': { bgcolor: 'action.hover' },
    }}
  >
    <Box sx={{ width: 4, borderRadius: 99, bgcolor: identityColor(d.by), flexShrink: 0 }} />
    <Box sx={{ width: 58, flexShrink: 0, pt: 0.25 }}>
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        {d.time ? clockText(d.time.start) : 'All day'}
      </Typography>
      {d.time?.end && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {clockText(d.time.end)}
        </Typography>
      )}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Typography
          noWrap
          sx={{
            fontWeight: 700,
            flex: 1,
            minWidth: 0,
            textDecoration: d.cancelled ? 'line-through' : 'none',
          }}
        >
          {d.title}
        </Typography>
        {d.weekly && (
          <RepeatRoundedIcon sx={{ fontSize: 15, color: 'text.secondary' }} titleAccess="Repeats" />
        )}
        <Face id={d.by} name={nameOf(d.by)} size={20} />
      </Stack>
      <Typography variant="caption" noWrap component="div" sx={{ color: 'text.secondary' }}>
        {[d.cancelled ? 'Cancelled' : null, d.place, d.from ? `From ${d.from.name}` : null]
          .filter(Boolean)
          .join(' · ') || (d.by === me ? 'Yours' : nameOf(d.by))}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        <AttendanceLine rsvps={rsvps} me={me} nameOf={nameOf} />
      </Box>
    </Box>
  </ButtonBase>
);
