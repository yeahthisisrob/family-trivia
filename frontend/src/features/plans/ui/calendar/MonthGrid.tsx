/**
 * A month as a seven-column grid (after Herd's MonthGrid): Monday first,
 * today in a filled circle, the picked day shaded, days outside the month
 * faded; each day's events as titles on a wide screen and dots on a phone.
 */
import type { Drop } from '@family-trivia/shared';
import { Box, ButtonBase, Paper, Typography } from '@mui/material';
import type React from 'react';
import { colors, identityColor, tint } from '../../../../shared/design-system';
import { daysIn } from '../../model/calendar';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const label = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

export const MonthGrid: React.FC<{
  month: string;
  from: string;
  to: string;
  today: string;
  selected: string;
  events: Map<string, Drop[]>;
  onSelect: (day: string) => void;
}> = ({ month, from, to, today, selected, events, onSelect }) => (
  <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 3 }}>
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      {WEEKDAYS.map((d) => (
        <Typography
          key={d}
          variant="caption"
          sx={{ py: 0.75, textAlign: 'center', fontWeight: 700, color: 'text.secondary' }}
        >
          {d}
        </Typography>
      ))}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
      {daysIn(from, to).map((k) => {
        const on = events.get(k) ?? [];
        const isToday = k === today;
        return (
          <ButtonBase
            key={k}
            onClick={() => onSelect(k)}
            aria-label={`${label(k)}${on.length ? `, ${on.length} event${on.length === 1 ? '' : 's'}` : ''}`}
            aria-pressed={k === selected}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'flex-start',
              textAlign: 'left',
              minHeight: { xs: 58, sm: 104 },
              p: { xs: 0.5, sm: 0.75 },
              borderRight: 1,
              borderBottom: 1,
              borderColor: 'divider',
              opacity: k.slice(0, 7) === month ? 1 : 0.4,
              bgcolor: k === selected ? 'action.selected' : 'transparent',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                width: 24,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                fontSize: 13,
                fontWeight: 700,
                ...(isToday ? { bgcolor: 'primary.main', color: colors.onColor } : {}),
              }}
            >
              {Number(k.slice(8, 10))}
            </Box>
            <Box
              sx={{
                mt: 0.5,
                display: { xs: 'none', sm: 'flex' },
                flexDirection: 'column',
                gap: '2px',
                minWidth: 0,
              }}
            >
              {on.slice(0, 3).map((d) => (
                <Box
                  key={d.id}
                  component="span"
                  sx={{
                    display: 'block',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    fontSize: 11,
                    fontWeight: 600,
                    lineHeight: '16px',
                    px: 0.5,
                    borderRadius: 0.5,
                    borderLeft: '2px solid',
                    borderLeftColor: identityColor(d.by),
                    bgcolor: tint(identityColor(d.by), 0.14),
                    textDecoration: d.cancelled ? 'line-through' : 'none',
                  }}
                >
                  {d.title}
                </Box>
              ))}
              {on.length > 3 && (
                <Typography
                  variant="caption"
                  sx={{ px: 0.5, fontSize: 10, color: 'text.secondary' }}
                >
                  +{on.length - 3}
                </Typography>
              )}
            </Box>
            <Box
              sx={{ mt: 'auto', display: { xs: 'flex', sm: 'none' }, gap: '2px', flexWrap: 'wrap' }}
            >
              {on.slice(0, 4).map((d) => (
                <Box
                  key={d.id}
                  component="span"
                  sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: identityColor(d.by) }}
                />
              ))}
            </Box>
          </ButtonBase>
        );
      })}
    </Box>
  </Paper>
);
