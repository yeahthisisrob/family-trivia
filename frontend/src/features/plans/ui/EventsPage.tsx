/**
 * The Events tab (docs/decisions/0036): what's coming up that you're
 * invited to, soonest first, each opening its page; and a new one.
 */
import { isEvent, type PlansView } from '@family-trivia/shared';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EventRoundedIcon from '@mui/icons-material/EventRounded';
import { Box, Button, ButtonBase, Card, Chip, Skeleton, Stack, Typography } from '@mui/material';
import type React from 'react';
import { Face } from '../../../entities/person';
import { whenText } from '../model/eventText';
import { usePlans } from '../model/usePlans';
import { useEventPages } from './EventPages';

export interface EventsPageViewProps {
  me: string;
  nameOf: (id: string) => string;
  /** Null while it loads. */
  view: PlansView | null;
  onOpen: (id: string, day: string) => void;
  onNew: (day: string) => void;
}

/** Each event in the weeks ahead, on its next day, soonest first. */
function upcoming(view: PlansView) {
  const next = new Map<string, string>();
  for (const day of view.days)
    for (const id of day.plans) if (!next.has(id)) next.set(id, day.date);
  return view.drops
    .filter((d) => isEvent(d) && next.has(d.id))
    .map((d) => ({ drop: d, day: next.get(d.id) as string }))
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        (a.drop.time?.start ?? '').localeCompare(b.drop.time?.start ?? ''),
    );
}

export const EventsPageView: React.FC<EventsPageViewProps> = ({
  me,
  nameOf,
  view,
  onOpen,
  onNew,
}) => {
  const list = view ? upcoming(view) : [];
  const today = view?.days[0]?.date ?? '';
  return (
    <Box sx={{ py: 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
        <EventRoundedIcon sx={{ color: 'primary.main' }} />
        <Typography variant="h5" component="h1" sx={{ fontWeight: 800, flex: 1 }}>
          Events
        </Typography>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => onNew(today)}>
          New event
        </Button>
      </Stack>
      {!view ? (
        <Stack spacing={1.5}>
          <Skeleton variant="rounded" height={84} />
          <Skeleton variant="rounded" height={84} />
        </Stack>
      ) : list.length === 0 ? (
        <Card sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700 }}>Nothing coming up</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            A birthday, a class anyone can watch, a visit: make one and say who it's for.
          </Typography>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {list.map(({ drop: d, day }) => {
            const answers = view.rsvps[d.id] ?? {};
            const going = Object.values(answers).filter((a) => a.answer === 'in').length;
            return (
              <Card key={d.id} sx={{ borderRadius: 3 }}>
                <ButtonBase
                  onClick={() => onOpen(d.id, day)}
                  aria-label={`${d.title}, details`}
                  sx={{ width: '100%', p: 2, justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%' }}>
                    <Face id={d.by} name={nameOf(d.by)} size={36} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontWeight: 800,
                          textDecoration: d.cancelled ? 'line-through' : 'none',
                        }}
                      >
                        {d.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {whenText(d, day)}
                        {d.place ? ` · ${d.place}` : ''}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {d.by === me ? 'Yours' : nameOf(d.by)}
                        {d.cancelled ? ' · cancelled' : ` · ${going} going`}
                        {answers[me]
                          ? ` · you: ${answers[me].answer === 'in' ? 'going' : answers[me].answer === 'out' ? "can't" : 'maybe'}`
                          : ''}
                      </Typography>
                    </Box>
                    {d.from && <Chip size="small" label={d.from.name} />}
                  </Stack>
                </ButtonBase>
              </Card>
            );
          })}
        </Stack>
      )}
    </Box>
  );
};

/** The Events tab, from the server. */
export const EventsPage: React.FC<{ me: string; nameOf: (id: string) => string }> = ({
  me,
  nameOf,
}) => {
  const { view } = usePlans();
  const pages = useEventPages(me, nameOf);
  return (
    <>
      <EventsPageView
        me={me}
        nameOf={nameOf}
        view={view}
        onOpen={pages.open}
        onNew={pages.create}
      />
      {pages.pages}
    </>
  );
};
