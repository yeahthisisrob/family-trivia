/**
 * The Events tab (docs/decisions/0036), after Herd's calendar: a month grid
 * or the month as an agenda, today marked, a repeating event on every day
 * it happens. Tap a day for what's on it (a sheet on a phone, a panel above
 * the grid on a wider screen) and an event for its page; add one in a
 * sentence or in the editor.
 */
import { getTodayET, type PlansView } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import ViewAgendaRoundedIcon from '@mui/icons-material/ViewAgendaRounded';
import {
  Box,
  Button,
  IconButton,
  Skeleton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type React from 'react';
import { useState } from 'react';
import { Sheet } from '../../../shared/design-system';
import { daysIn, eventsByDay, monthWindow, shiftMonth } from '../model/calendar';
import { useCalendar } from '../model/usePlans';
import { AgendaList } from './calendar/AgendaList';
import { DayPanel, dayTitle } from './calendar/DayPanel';
import { MonthGrid } from './calendar/MonthGrid';
import { useEventPages } from './EventPages';

type View = 'month' | 'list';

export interface EventsCalendarViewProps {
  me: string;
  nameOf: (id: string) => string;
  today: string;
  month: string;
  onMonth: (month: string) => void;
  /** The month's days, from the server; null while they load. */
  view: PlansView | null;
  onOpen: (id: string, day: string) => void;
  onNew: (day: string) => void;
  onQuickAdd: () => void;
  /** Start in the list (stories). */
  initialView?: View;
}

export const EventsCalendarView: React.FC<EventsCalendarViewProps> = ({
  me,
  nameOf,
  today,
  month,
  onMonth,
  view,
  onOpen,
  onNew,
  onQuickAdd,
  initialView = 'month',
}) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [mode, setMode] = useState<View>(initialView);
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const { from, to } = monthWindow(month);
  const selected =
    picked && picked.slice(0, 7) === month
      ? picked
      : month === today.slice(0, 7)
        ? today
        : `${month}-01`;
  const events = view ? eventsByDay(view) : new Map();
  const rsvps = view?.rsvps ?? {};
  const title = new Date(`${month}-15T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
  const pick = (day: string) => {
    setPicked(day);
    if (day.slice(0, 7) !== month) onMonth(day.slice(0, 7));
    setMode('month');
    if (phone) setSheet(true);
  };
  const dayPanel = (bare?: boolean) => (
    <DayPanel
      day={selected}
      events={events.get(selected) ?? []}
      rsvps={rsvps}
      me={me}
      nameOf={nameOf}
      onOpen={onOpen}
      onAdd={onNew}
      bare={bare}
    />
  );

  return (
    <Stack spacing={1.5} sx={{ py: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800, flex: 1 }}>
          Events
        </Typography>
        <Button startIcon={<AutoAwesomeRoundedIcon />} onClick={onQuickAdd}>
          Say it
        </Button>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => onNew(selected)}>
          New
        </Button>
      </Stack>

      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_e, v: View | null) => v && setMode(v)}
          aria-label="Show"
        >
          <ToggleButton value="month" aria-label="Month">
            <CalendarMonthRoundedIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List">
            <ViewAgendaRoundedIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        <Stack
          direction="row"
          sx={{ alignItems: 'center', flex: 1, minWidth: 0, justifyContent: 'center' }}
        >
          <IconButton
            size="small"
            aria-label="Previous month"
            onClick={() => onMonth(shiftMonth(month, -1))}
          >
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Typography sx={{ fontWeight: 800, minWidth: 140, textAlign: 'center' }}>
            {title}
          </Typography>
          <IconButton
            size="small"
            aria-label="Next month"
            onClick={() => onMonth(shiftMonth(month, 1))}
          >
            <ChevronRightRoundedIcon />
          </IconButton>
        </Stack>
        {month !== today.slice(0, 7) && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              onMonth(today.slice(0, 7));
              setPicked(today);
            }}
          >
            Today
          </Button>
        )}
      </Stack>

      {!view ? (
        <Skeleton variant="rounded" height={phone ? 360 : 640} />
      ) : mode === 'list' ? (
        <AgendaList
          days={daysIn(from, to).filter((d) => d.slice(0, 7) === month)}
          today={today}
          events={events}
          rsvps={rsvps}
          me={me}
          nameOf={nameOf}
          onPickDay={pick}
          onOpen={onOpen}
        />
      ) : (
        <>
          {!phone && dayPanel()}
          <MonthGrid
            month={month}
            from={from}
            to={to}
            today={today}
            selected={selected}
            events={events}
            onSelect={pick}
          />
          {phone && (
            <Box>
              {/* The picked day under the grid too, so a phone shows it without a tap. */}
              {dayPanel()}
            </Box>
          )}
        </>
      )}

      {phone && (
        <Sheet open={sheet} onClose={() => setSheet(false)} title={dayTitle(selected)}>
          {dayPanel(true)}
        </Sheet>
      )}
    </Stack>
  );
};

/** The Events tab, from the server: the month on screen, its events' pages, quick add and the editor. */
export const EventsCalendar: React.FC<{ me: string; nameOf: (id: string) => string }> = ({
  me,
  nameOf,
}) => {
  const today = getTodayET();
  const [month, setMonth] = useState(today.slice(0, 7));
  const { from, to } = monthWindow(month);
  const { data } = useCalendar(from, to);
  const pages = useEventPages(me, nameOf);
  return (
    <>
      <EventsCalendarView
        me={me}
        nameOf={nameOf}
        today={today}
        month={month}
        onMonth={setMonth}
        view={data ?? null}
        onOpen={pages.open}
        onNew={pages.create}
        onQuickAdd={pages.quickAdd}
      />
      {pages.pages}
    </>
  );
};
