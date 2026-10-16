/**
 * Looking back on a season. Top to bottom by what the family comes back
 * for: which season and its numbers, the questions most of us answered with
 * everyone's answers side by side, what we loved, everyone's season, then
 * every day's question, month by month. The season can be made into a
 * printed book (BookDialog).
 */
import type { BookPage, SeasonReview } from '@family-trivia/shared';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import {
  Alert,
  Avatar,
  Box,
  Button,
  ButtonBase,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useFamily } from '../../../entities/family';
import { dayName, monthName } from '../../../shared/dates';
import { identityColor } from '../../../shared/design-system';
import { lookBackApi } from '../api/lookBackApi';
import { seasonDates } from '../model/dates';
import { BookDialog } from './BookDialog';

const FIRST_MONTHS = 1;
const plural = (n: number, one: string) => `${n.toLocaleString()} ${n === 1 ? one : `${one}s`}`;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box component="section">
    <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 800, mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

/** One question with everyone's answers under it. */
const Page: React.FC<{
  page: BookPage;
  nameOf: (id: string) => string;
  onOpenPerson?: (id: string) => void;
}> = ({ page, nameOf, onOpenPerson }) => (
  <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
    <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{page.question}</Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {dayName(page.date)} · {page.answers.length} answered
    </Typography>
    <Stack spacing={0.75} sx={{ mt: 1.25 }}>
      {page.answers.map((a) => (
        <Typography key={a.personId}>
          <ButtonBase
            disabled={!onOpenPerson}
            onClick={() => onOpenPerson?.(a.personId)}
            sx={{ fontWeight: 700, color: 'text.primary', verticalAlign: 'baseline' }}
          >
            {nameOf(a.personId)}
          </ButtonBase>{' '}
          {a.answer}
        </Typography>
      ))}
    </Stack>
  </Paper>
);

export const SeasonLookBack: React.FC<{ onOpenPerson?: (id: string) => void }> = ({
  onOpenPerson,
}) => {
  const { family, photoUrls } = useFamily();
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [review, setReview] = useState<SeasonReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [allMonths, setAllMonths] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);

  useEffect(() => {
    setReview(null);
    setFailed(false);
    setAllMonths(false);
    lookBackApi
      .review(season)
      .then(setReview)
      .catch(() => setFailed(true));
  }, [season]);

  const months = useMemo(() => {
    const out: { month: string; pages: BookPage[] }[] = [];
    for (const p of review?.book ?? []) {
      const m = p.date.slice(0, 7);
      const last = out.at(-1);
      if (last?.month === m) last.pages.push(p);
      else out.push({ month: m, pages: [p] });
    }
    return out;
  }, [review]);

  const nameOf = (id: string) => family?.people[id]?.name ?? id;
  const photoOf = (id: string) => {
    const key = family?.people[id]?.photo;
    return key ? photoUrls[key] : undefined;
  };

  if (failed) return <Alert severity="info">There’s no season to look back on yet.</Alert>;
  if (!review) return <Skeleton variant="rounded" height={320} />;

  const n = review.numbers;
  const shown = allMonths ? months : months.slice(0, FIRST_MONTHS);

  return (
    <Stack spacing={4} sx={{ maxWidth: 720, mx: 'auto', pb: 6 }}>
      {/* Which season, and the shape of it */}
      <Stack spacing={1.5}>
        {review.seasons.length > 1 && (
          <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap' }}>
            {review.seasons.map((s) => (
              <Chip
                key={s.number}
                label={s.name}
                color={s.number === review.season.number ? 'primary' : 'default'}
                variant={s.number === review.season.number ? 'filled' : 'outlined'}
                onClick={() => setSeason(s.number)}
              />
            ))}
          </Stack>
        )}
        <Box>
          <Typography component="h1" sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.15 }}>
            {review.season.name}
          </Typography>
          <Typography sx={{ color: 'text.secondary' }}>{seasonDates(review.season)}</Typography>
        </Box>
        <Typography>
          {[
            `${n.people} of us`,
            `${n.answers.toLocaleString()} answers`,
            `${n.words.toLocaleString()} words`,
            n.trivia ? `${n.trivia.toLocaleString()} trivia questions` : null,
            n.comments ? `${n.comments} comments` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
        {review.book.length > 0 && (
          <Box>
            <Button
              variant="contained"
              startIcon={<AutoStoriesIcon />}
              onClick={() => setBookOpen(true)}
            >
              Make it a book
            </Button>
          </Box>
        )}
      </Stack>

      {review.together.length > 0 && (
        <Section title="The questions most of us answered">
          <Stack spacing={1.5}>
            {review.together.map((p) => (
              <Page
                key={`${p.date}${p.question}`}
                page={p}
                nameOf={nameOf}
                onOpenPerson={onOpenPerson}
              />
            ))}
          </Stack>
        </Section>
      )}

      {review.loved.length > 0 && (
        <Section title="What we loved">
          <Stack spacing={2}>
            {review.loved.map((l) => (
              <Box
                key={l.id}
                sx={{ borderLeft: 3, borderColor: identityColor(l.personId), pl: 1.5 }}
              >
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {l.question}
                </Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '1.05rem' }}>“{l.answer}”</Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {[
                    nameOf(l.personId),
                    l.reactions ? plural(l.reactions, 'reaction') : null,
                    l.comments ? plural(l.comments, 'comment') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Section>
      )}

      {review.people.length > 0 && (
        <Section title="Everyone’s season">
          <Stack spacing={0.5}>
            {review.people.map((p) => (
              <ButtonBase
                key={p.personId}
                disabled={!onOpenPerson}
                onClick={() => onOpenPerson?.(p.personId)}
                sx={{
                  justifyContent: 'flex-start',
                  gap: 1.5,
                  py: 1,
                  borderRadius: 2,
                  textAlign: 'left',
                }}
              >
                <Avatar
                  src={photoOf(p.personId)}
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: identityColor(p.personId),
                    fontWeight: 800,
                  }}
                >
                  {nameOf(p.personId).slice(0, 1)}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{nameOf(p.personId)}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {[
                      p.answers
                        ? `${plural(p.answers, 'answer')}, ${plural(p.words, 'word')}`
                        : null,
                      p.trivia
                        ? `${Math.round((p.right / p.trivia) * 100)}% of ${p.trivia} trivia right`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
              </ButtonBase>
            ))}
          </Stack>
        </Section>
      )}

      {months.length > 0 && (
        <Section title="Every day’s question">
          <Stack spacing={3}>
            {shown.map((m) => (
              <Box key={m.month}>
                <Typography
                  component="h3"
                  sx={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    mb: 1,
                  }}
                >
                  {monthName(m.month)}
                </Typography>
                <Stack spacing={1.5}>
                  {m.pages.map((p) => (
                    <Page
                      key={`${p.date}${p.question}`}
                      page={p}
                      nameOf={nameOf}
                      onOpenPerson={onOpenPerson}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
          {!allMonths && months.length > FIRST_MONTHS && (
            <Button onClick={() => setAllMonths(true)} sx={{ mt: 2 }}>
              Read all {review.book.length} days
            </Button>
          )}
        </Section>
      )}
      {bookOpen && <BookDialog season={review.season} onClose={() => setBookOpen(false)} />}
    </Stack>
  );
};
