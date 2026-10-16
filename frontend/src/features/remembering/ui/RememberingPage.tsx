/**
 * Remembering someone: their page once the family has lost them. Top to
 * bottom by what the family comes for: who they were and the last things
 * they told us, what the family loved of theirs, the family's memories, and
 * then everything they shared, month by month. All of it can be saved as a
 * keepsake page that prints.
 */
import {
  byMonth,
  type Comment,
  type FamilyPerson,
  LAST_WORDS,
  type RememberedWord,
  type Remembering,
  spanLabel,
} from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { paper } from '../../../shared/design-system';
import { rememberingApi } from '../api/rememberingApi';
import { saveKeepsake } from '../model/keepsake';
import { Memories } from './Memories';

const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
const month = (ym: string) =>
  new Date(`${ym}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** "1950 – 2026", or the day they died when we don't know when they were born. */
export function yearsOf(p: FamilyPerson): string | null {
  const died = p.memorial?.died;
  if (!died) return null;
  const born = p.born?.date?.slice(0, 4);
  if (born) return `${born} – ${died.slice(0, 4)}`;
  return died.length === 10 ? day(died) : died;
}

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography
    component="h2"
    sx={{
      fontFamily: paper.serif,
      fontSize: '1.3rem',
      fontWeight: 700,
      borderBottom: `1px solid ${paper.rule}`,
      pb: 0.75,
      mb: 1.5,
    }}
  >
    {children}
  </Typography>
);

const Word: React.FC<{ w: RememberedWord; showDate?: boolean; note?: string }> = ({
  w,
  showDate,
  note,
}) => (
  <Box sx={{ breakInside: 'avoid' }}>
    <Typography sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontSize: '0.95rem' }}>
      {w.question}
    </Typography>
    <Typography sx={{ fontFamily: paper.serif, fontSize: '1.2rem', lineHeight: 1.45 }}>
      “{w.answer}”
    </Typography>
    {(showDate || note) && (
      <Typography sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontSize: '0.85rem' }}>
        {[showDate ? day(w.date) : null, note].filter(Boolean).join(' · ')}
      </Typography>
    )}
  </Box>
);

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How many months show before "Read everything". */
const FIRST_MONTHS = 2;

export const RememberingPage: React.FC<{
  person: FamilyPerson;
  photo?: string;
  /** What they often talked about, from the family's index. */
  topics?: string[];
  nameOf: (id: string) => string;
  onClose: () => void;
}> = ({ person, photo, topics = [], nameOf, onClose }) => {
  const [data, setData] = useState<Remembering | null>(null);
  const [failed, setFailed] = useState(false);
  const [memories, setMemories] = useState<Comment[] | null>(null);
  const [all, setAll] = useState(false);
  const name = person.name;
  const years = yearsOf(person);
  const dedication = person.memorial?.dedication;

  useEffect(() => {
    rememberingApi
      .get(person.id)
      .then(setData)
      .catch(() => setFailed(true));
    rememberingApi
      .memories(person.id)
      .then(setMemories)
      .catch(() => setMemories([]));
  }, [person.id]);

  const byId = useMemo(() => new Map(data?.words.map((w) => [w.id, w]) ?? []), [data]);
  const months = useMemo(() => (data ? byMonth(data.words) : []), [data]);
  const shown = all ? months : months.slice(0, FIRST_MONTHS);
  const span = data ? spanLabel(data.span) : null;

  const share = async (text: string) => {
    const c = await rememberingApi.share(person.id, text);
    setMemories((m) => [...(m ?? []), c]);
  };

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-labelledby="remembering-name"
      slotProps={{ paper: { sx: { bgcolor: paper.paper, color: paper.ink } } }}
    >
      <Box data-light-surface sx={{ bgcolor: paper.paper, color: paper.ink, minHeight: '100%' }}>
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'fixed', top: 8, right: 8, color: paper.ink, zIndex: 1 }}
        >
          <CloseIcon />
        </IconButton>
        <Stack spacing={5} sx={{ maxWidth: 640, mx: 'auto', px: { xs: 2.5, sm: 3 }, py: 6 }}>
          {/* Who they were, and the shape of what they left */}
          <Stack spacing={1.5} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <Avatar
              src={photo}
              alt=""
              sx={{
                width: 112,
                height: 112,
                fontSize: '2.5rem',
                fontFamily: paper.serif,
                bgcolor: paper.edge,
                color: paper.ink,
                boxShadow: `0 6px 18px ${paper.shadow}`,
              }}
            >
              {name.slice(0, 1)}
            </Avatar>
            <Typography
              id="remembering-name"
              component="h1"
              sx={{ fontFamily: paper.serif, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1 }}
            >
              {name}
            </Typography>
            {years && (
              <Typography
                sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontSize: '1.1rem' }}
              >
                {years}
              </Typography>
            )}
            {dedication && (
              <Typography sx={{ fontFamily: paper.serif, fontStyle: 'italic', fontSize: '1.2rem' }}>
                {dedication}
              </Typography>
            )}
            {data && (
              <Typography sx={{ fontFamily: paper.serif, color: paper.inkSoft }}>
                {[
                  data.words.length ? `${plural(data.words.length, 'answer')} shared` : null,
                  data.trivia.played ? plural(data.trivia.played, 'trivia question') : null,
                  span,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            )}
            {data && data.words.length > 0 && (
              <Button
                startIcon={<SaveAltIcon />}
                onClick={() =>
                  saveKeepsake({
                    name,
                    years,
                    dedication,
                    remembering: data,
                    memories: memories ?? [],
                    nameOf,
                  })
                }
                sx={{ color: paper.ink, fontFamily: paper.serif }}
              >
                Save a keepsake
              </Button>
            )}
          </Stack>

          {failed && (
            <Typography sx={{ fontFamily: paper.serif, textAlign: 'center' }}>
              {name}’s words didn’t load. Close this and open it again.
            </Typography>
          )}
          {!data && !failed && <Skeleton variant="rounded" height={180} />}

          {data && data.last.length > 0 && (
            <Box>
              <Heading>The last things {name} told us</Heading>
              <Stack spacing={2.25}>
                {data.last.slice(0, LAST_WORDS).map((id) => {
                  const w = byId.get(id);
                  return w ? <Word key={id} w={w} showDate /> : null;
                })}
              </Stack>
            </Box>
          )}

          {data && data.loved.length > 0 && (
            <Box>
              <Heading>What the family loved</Heading>
              <Stack spacing={2.25}>
                {data.loved.map((l) => {
                  const w = byId.get(l.id);
                  if (!w) return null;
                  const note = [
                    l.reactions ? plural(l.reactions, 'reaction') : null,
                    l.comments ? plural(l.comments, 'comment') : null,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return <Word key={l.id} w={w} note={note} />;
                })}
              </Stack>
            </Box>
          )}

          <Box>
            <Heading>Memories of {name}</Heading>
            <Memories name={name} memories={memories} nameOf={nameOf} onShare={share} />
          </Box>

          {topics.length > 0 && (
            <Box>
              <Heading>{name} often talked about</Heading>
              <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                {topics.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    variant="outlined"
                    sx={{ fontFamily: paper.serif, color: paper.ink, borderColor: paper.rule }}
                  />
                ))}
              </Stack>
            </Box>
          )}

          {months.length > 0 && (
            <Box>
              <Heading>Everything {name} shared</Heading>
              <Stack spacing={3}>
                {shown.map((m) => (
                  <Box key={m.month}>
                    <Typography
                      component="h3"
                      sx={{
                        fontFamily: paper.serif,
                        fontStyle: 'italic',
                        color: paper.inkSoft,
                        mb: 1,
                      }}
                    >
                      {month(m.month)}
                    </Typography>
                    <Stack spacing={1.75}>
                      {m.words.map((w) => (
                        <Word key={w.id} w={w} />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
              {!all && months.length > FIRST_MONTHS && (
                <Button
                  onClick={() => setAll(true)}
                  sx={{ mt: 2, color: paper.ink, fontFamily: paper.serif }}
                >
                  Read all {data?.words.length} answers
                </Button>
              )}
            </Box>
          )}
        </Stack>
      </Box>
    </Dialog>
  );
};
