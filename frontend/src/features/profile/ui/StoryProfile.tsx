/**
 * Someone's profile, told as a story. Top to bottom by what a reader comes
 * for: who they are and what the family's index says about them, their
 * numbers in one line, what they've said lately, what the family loved, what
 * the reader shares with them, what they talk about, then their trivia and
 * everything they've ever shared. The owner fills in their story near the
 * top and edits answers at the end. Someone the family has lost opens on
 * their Remembering page instead.
 */
import {
  byMonth,
  type FamilyKnowledge,
  householdsOf,
  type Likeness,
  type PersonStory,
  relationOf,
  type StoryWord,
  spanLabel,
  type UserProfile,
} from '@family-trivia/shared';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Avatar,
  alpha,
  Box,
  Button,
  ButtonBase,
  Chip,
  Collapse,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { getMemberSummary, getUserProfile } from '../../../api/modules/user';
import PersonalQuestionsHistory from '../../../components/PersonalQuestionsHistory';
import ScoreHistory from '../../../components/Profile/ScoreHistory';
import UserTimeline from '../../../components/Profile/UserTimeline';
import { graphApi, knowledgeApi, storyApi, useFamily } from '../../../entities/family';
import { identityColor } from '../../../shared/design-system';
import { FillIn } from '../../fill-in';
import { PersonBookButton } from '../../person-book';
import { RememberingPage } from '../../remembering';

const LATELY = 5;
const emptyStory = (personId: string): PersonStory => ({
  personId,
  words: [],
  last: [],
  loved: [],
  trivia: { played: 0, right: 0 },
  span: { first: null, last: null },
});
const FIRST_MONTHS = 2;

const day = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const monthName = (ym: string) =>
  new Date(`${ym}-15T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box component="section">
    <Typography component="h2" sx={{ fontSize: '1.15rem', fontWeight: 800, mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

const Said: React.FC<{ w: StoryWord; color: string; note?: string | null }> = ({
  w,
  color,
  note,
}) => (
  <Box sx={{ borderLeft: 3, borderColor: color, pl: 1.5 }}>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {w.question}
    </Typography>
    <Typography sx={{ fontWeight: 600, fontSize: '1.05rem' }}>“{w.answer}”</Typography>
    {note && (
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {note}
      </Typography>
    )}
  </Box>
);

const Stat: React.FC<{ value: string | number; label: string; onClick?: () => void }> = ({
  value,
  label,
  onClick,
}) => (
  <ButtonBase
    disabled={!onClick}
    onClick={onClick}
    sx={{ flexDirection: 'column', alignItems: 'flex-start', borderRadius: 1, textAlign: 'left' }}
  >
    <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
    <Typography variant="caption" sx={{ opacity: 0.85 }}>
      {label}
    </Typography>
  </ButtonBase>
);

export const StoryProfile: React.FC<{
  userId: string;
  meId: string | null;
  onBack: () => void;
}> = ({ userId, meId, onBack }) => {
  const { family, photoUrls } = useFamily();
  const [story, setStory] = useState<PersonStory | null>(null);
  const [knowledge, setKnowledge] = useState<FamilyKnowledge | null>(null);
  const [likenesses, setLikenesses] = useState<Likeness[]>([]);
  const [trivia, setTrivia] = useState<UserProfile | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [allMonths, setAllMonths] = useState(false);
  const [triviaOpen, setTriviaOpen] = useState(false);
  const [scoresOpen, setScoresOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const isMe = userId === meId;
  const person = family?.people[userId];
  const theme = useTheme();
  const color = identityColor(userId);
  // Text on their color: dark on the light ones (yellow, lime), light on the rest.
  const ink = theme.palette.getContrastText(color);
  const known = knowledge?.people[userId];

  useEffect(() => {
    setStory(null);
    setSummary(null);
    setAllMonths(false);
    storyApi
      .get(userId)
      .then(setStory)
      .catch(() => setStory(emptyStory(userId)));
    knowledgeApi
      .get()
      .then(setKnowledge)
      .catch(() => undefined);
    graphApi
      .get()
      .then((g) => setLikenesses(g.likenesses))
      .catch(() => undefined);
    getUserProfile(userId)
      .then(setTrivia)
      .catch(() => undefined);
  }, [userId]);

  // The persona from the family's index leads; the member summary fills in until there is one.
  useEffect(() => {
    if (!knowledge || known?.persona) return;
    getMemberSummary(userId, 'regular')
      .then((r) => setSummary(r.summary))
      .catch(() => undefined);
  }, [knowledge, known?.persona, userId]);

  const byId = useMemo(() => new Map(story?.words.map((w) => [w.id, w]) ?? []), [story]);
  const months = useMemo(() => (story ? byMonth(story.words).reverse() : []), [story]);

  if (!family) return <Skeleton variant="rounded" height={320} />;
  if (person?.memorial)
    return (
      <RememberingPage
        person={person}
        photo={photoUrls[person.memorial.photo ?? person.photo ?? '']}
        topics={known?.top.map((t) => t.name)}
        nameOf={(id) => family.people[id]?.name ?? id}
        onClose={onBack}
      />
    );

  const name = person?.name ?? userId;
  const photo = person?.photo ? photoUrls[person.photo] : undefined;
  const relation = meId && !isMe ? relationOf(family, meId, userId) : null;
  const homes = householdsOf(family, userId)
    .map((h) => h.name)
    .join(' & ');
  const since = story?.span.first
    ? spanLabel({ first: story.span.first, last: story.span.first })
    : null;
  const lede = known?.persona?.text ?? summary;
  const traits = known?.persona?.traits ?? [];
  const likeness =
    likenesses.find((l) => (l.a === meId && l.b === userId) || (l.b === meId && l.a === userId)) ??
    null;
  const shown = allMonths ? months : months.slice(0, FIRST_MONTHS);
  const right = story?.trivia.played
    ? Math.round((story.trivia.right / story.trivia.played) * 100)
    : null;

  return (
    <Stack spacing={3.5} sx={{ pb: 6 }}>
      {/* Who they are */}
      <Paper
        sx={{
          overflow: 'hidden',
          borderRadius: 3,
          bgcolor: color,
          color: ink,
          position: 'relative',
        }}
      >
        <IconButton
          aria-label="Back"
          onClick={onBack}
          sx={{ position: 'absolute', top: 8, left: 8, color: 'inherit' }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Stack spacing={2} sx={{ px: { xs: 2.5, sm: 3.5 }, pt: 7, pb: 3 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Avatar
              src={photo}
              alt=""
              sx={{
                width: 84,
                height: 84,
                fontSize: '2rem',
                fontWeight: 800,
                bgcolor: alpha(ink, 0.22),
                color: 'inherit',
                border: `3px solid ${alpha(ink, 0.65)}`,
              }}
            >
              {name.slice(0, 1)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.1 }}
              >
                {name}
              </Typography>
              <Typography sx={{ opacity: 0.9 }}>
                {[isMe ? 'You' : relation ? `Your ${relation}` : null, homes || null]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
              {since && (
                <Typography variant="body2" sx={{ opacity: 0.85 }}>
                  Answering since {since}
                </Typography>
              )}
            </Box>
          </Stack>
          {lede ? (
            <Typography sx={{ fontSize: '1.08rem', lineHeight: 1.6 }}>{lede}</Typography>
          ) : (
            knowledge && !summary && <Skeleton sx={{ bgcolor: alpha(ink, 0.2) }} />
          )}
          {traits.length > 0 && (
            <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
              {traits.map((t) => (
                <Chip
                  key={t}
                  label={t}
                  size="small"
                  sx={{ bgcolor: alpha(ink, 0.2), color: 'inherit' }}
                />
              ))}
            </Stack>
          )}
          {/* The numbers, in one row with the story, not a second card */}
          {story && (
            <Stack direction="row" sx={{ gap: { xs: 2.5, sm: 4 }, flexWrap: 'wrap', pt: 0.5 }}>
              <Stat value={story.words.length} label="answers shared" />
              {!!known?.stats.bestStreak && known.stats.bestStreak > 1 && (
                <Stat value={`${known.stats.bestStreak} days`} label="longest run" />
              )}
              {!!trivia?.totalScore && (
                <Stat
                  value={trivia.totalScore}
                  label="trivia points"
                  onClick={() => setScoresOpen(true)}
                />
              )}
              {right !== null && <Stat value={`${right}%`} label="trivia right" />}
            </Stack>
          )}
        </Stack>
      </Paper>

      {isMe && <FillIn />}

      {!story && <Skeleton variant="rounded" height={160} />}

      {story && story.last.length > 0 && (
        <Section title={isMe ? 'What you’ve said lately' : `What ${name} has said lately`}>
          <Stack spacing={2}>
            {story.last.slice(0, LATELY).map((id) => {
              const w = byId.get(id);
              return w ? <Said key={id} w={w} color={color} note={day(w.date)} /> : null;
            })}
          </Stack>
        </Section>
      )}

      {story && story.loved.length > 0 && (
        <Section title="What the family loved">
          <Stack spacing={2}>
            {story.loved.map((l) => {
              const w = byId.get(l.id);
              if (!w) return null;
              const note = [
                l.reactions ? plural(l.reactions, 'reaction') : null,
                l.comments ? plural(l.comments, 'comment') : null,
              ]
                .filter(Boolean)
                .join(', ');
              return <Said key={l.id} w={w} color={color} note={note} />;
            })}
          </Stack>
        </Section>
      )}

      {!isMe && likeness && (
        <Section title={`You & ${name}`}>
          <Typography sx={{ mb: 1.5 }}>
            You answered {plural(likeness.count, 'question')} alike
            {likeness.strength
              ? `, ${Math.round(likeness.strength * 100)}% of the ones you both answered`
              : ''}
            .
          </Typography>
          <Stack spacing={1.25}>
            {likeness.examples.map((e) => (
              <Box key={e.question} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                  {e.question}
                </Typography>
                <Typography>
                  <b>You:</b> {likeness.a === meId ? e.a : e.b}
                </Typography>
                <Typography>
                  <b>{name}:</b> {likeness.a === meId ? e.b : e.a}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Section>
      )}

      {known && known.top.length > 0 && (
        <Section title={isMe ? 'You often talk about' : `${name} often talks about`}>
          <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
            {known.top.map((t) => (
              <Chip key={`${t.kind}:${t.name}`} label={t.name} variant="outlined" />
            ))}
          </Stack>
        </Section>
      )}

      {story && story.trivia.played > 0 && (
        <Section title="Trivia">
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
              <Stat value={story.trivia.played} label="questions played" />
              {!!trivia?.totalScore && (
                <Stat
                  value={trivia.totalScore}
                  label="points · see how"
                  onClick={() => setScoresOpen(true)}
                />
              )}
              {!!trivia?.streak && <Stat value={trivia.streak} label="right in a row" />}
              {!!trivia?.categoryBonusStats?.timesBonusEarned && (
                <Stat value={trivia.categoryBonusStats.totalBonusPoints} label="bonus points" />
              )}
            </Stack>
            <Button size="small" onClick={() => setTriviaOpen((o) => !o)} sx={{ mt: 1.5, ml: -1 }}>
              {triviaOpen ? 'Hide every trivia answer' : 'See every trivia answer'}
            </Button>
            <Collapse in={triviaOpen} unmountOnExit>
              <Box sx={{ mt: 1 }}>
                <UserTimeline userId={userId} />
              </Box>
            </Collapse>
          </Paper>
        </Section>
      )}

      {months.length > 0 && (
        <Section title={isMe ? 'Everything you’ve shared' : `Everything ${name} has shared`}>
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
                  {[...m.words].reverse().map((w) => (
                    <Said key={w.id} w={w} color={color} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
          {!allMonths && months.length > FIRST_MONTHS && (
            <Button onClick={() => setAllMonths(true)} sx={{ mt: 2 }}>
              Read all {story?.words.length} answers
            </Button>
          )}
          <Box sx={{ mt: 1 }}>
            <PersonBookButton
              personId={userId}
              name={name}
              label={isMe ? 'Make a book of your answers' : `Make a book of ${name}’s answers`}
            />
          </Box>
        </Section>
      )}

      {story && story.words.length === 0 && !isMe && (
        <Typography sx={{ color: 'text.secondary' }}>{name} hasn’t shared anything yet.</Typography>
      )}

      {isMe && (
        <Box>
          <Button variant="outlined" onClick={() => setEditing((o) => !o)}>
            {editing ? 'Done editing' : 'Edit your answers'}
          </Button>
          <Collapse in={editing} unmountOnExit>
            <Box sx={{ mt: 2 }}>
              <PersonalQuestionsHistory userId={userId} />
            </Box>
          </Collapse>
        </Box>
      )}

      {trivia && (
        <ScoreHistory
          open={scoresOpen}
          onClose={() => setScoresOpen(false)}
          scoringHistory={trivia.scoringHistory || []}
          totalScore={trivia.totalScore || 0}
        />
      )}
    </Stack>
  );
};
