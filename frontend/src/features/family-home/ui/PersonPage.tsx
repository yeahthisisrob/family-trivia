/**
 * One person, opened from anywhere on the Family tab: who they are in the
 * app's words, what they said in their own, and what the reader shares with
 * them. Full screen on a phone.
 */
import type { Likeness, MemberInsight } from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Chip,
  Dialog,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { getMemberSummary } from '../../../api/modules/user';
import { colors, identityColor, paper } from '../../../shared/design-system';
import { familyHomeApi, type Words } from '../api/familyHomeApi';
import { type PersonView, relationLabel } from '../model/people';
import { Face } from './Face';

type TabId = 'about' | 'words' | 'you';

const About: React.FC<{ person: PersonView; dedication?: string }> = ({ person, dedication }) => {
  const [summary, setSummary] = useState<{ text: string; insights: MemberInsight[] } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getMemberSummary(person.id, 'regular')
      .then((r) => setSummary({ text: r.summary, insights: r.insights ?? [] }))
      .catch(() => setFailed(true));
  }, [person.id]);

  return (
    <Stack spacing={2}>
      {dedication && (
        <Typography sx={{ fontFamily: paper.serif, fontStyle: 'italic', fontSize: '1.1rem' }}>
          {dedication}
        </Typography>
      )}
      {summary ? (
        <Typography sx={{ lineHeight: 1.65 }}>{summary.text}</Typography>
      ) : failed ? (
        <Typography sx={{ color: 'text.secondary' }}>
          {person.facts
            ? 'Their summary isn’t ready yet.'
            : `${person.name} hasn’t shared anything yet.`}
        </Typography>
      ) : (
        <Box>
          <Skeleton />
          <Skeleton width="90%" />
          <Skeleton width="70%" />
        </Box>
      )}
      {summary && summary.insights.length > 0 && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
          {summary.insights.map((i) => (
            <Chip key={i.text} label={i.text} size="small" sx={{ bgcolor: 'action.hover' }} />
          ))}
        </Stack>
      )}
      <Stack direction="row" sx={{ gap: 3, flexWrap: 'wrap' }}>
        <Fact value={person.facts} label="answers shared" />
        {person.accuracy !== null && <Fact value={`${person.accuracy}%`} label="trivia right" />}
        {person.sinceYear && <Fact value={person.sinceYear} label="playing since" />}
      </Stack>
    </Stack>
  );
};

const Fact: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: '1.25rem', fontWeight: 800 }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
  </Box>
);

const InTheirWords: React.FC<{ person: PersonView }> = ({ person }) => {
  const [words, setWords] = useState<Words['words'] | null>(null);
  useEffect(() => {
    familyHomeApi
      .words(person.id)
      .then((w) => setWords(w.words))
      .catch(() => setWords([]));
  }, [person.id]);

  if (!words) return <Skeleton height={120} />;
  if (!words.length)
    return (
      <Typography sx={{ color: 'text.secondary' }}>
        Nothing in {person.name}'s own words yet.
      </Typography>
    );
  return (
    <Stack spacing={1.5}>
      {words.map((w) => (
        <Box
          key={`${w.date}-${w.question}`}
          sx={{ borderLeft: 3, borderColor: identityColor(person.id), pl: 1.5 }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {w.question}
          </Typography>
          <Typography sx={{ fontWeight: 600 }}>“{w.answer}”</Typography>
          {w.date && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {new Date(`${w.date}T12:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </Typography>
          )}
        </Box>
      ))}
    </Stack>
  );
};

const YouAndThem: React.FC<{ person: PersonView; likeness: Likeness | null; meIsA: boolean }> = ({
  person,
  likeness,
  meIsA,
}) => (
  <Stack spacing={2}>
    <Typography>
      {person.name} is {relationLabel(person.relation, false)}.
    </Typography>
    {likeness ? (
      <>
        <Typography>
          You answered {likeness.count} {likeness.count === 1 ? 'question' : 'questions'} alike
          {likeness.strength
            ? `, ${Math.round(likeness.strength * 100)}% of the ones you both answered`
            : ''}
          .
        </Typography>
        {likeness.examples.map((e) => (
          <Box key={e.question} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
              {e.question}
            </Typography>
            <Typography>
              <b>You:</b> {meIsA ? e.a : e.b}
            </Typography>
            <Typography>
              <b>{person.name}:</b> {meIsA ? e.b : e.a}
            </Typography>
          </Box>
        ))}
      </>
    ) : (
      <Typography sx={{ color: 'text.secondary' }}>
        No answers alike yet. The more you both share, the more shows up here.
      </Typography>
    )}
  </Stack>
);

export const PersonPage: React.FC<{
  person: PersonView;
  meId: string | null;
  photo?: string;
  dedication?: string;
  likenesses: Likeness[];
  onClose: () => void;
}> = ({ person, meId, photo, dedication, likenesses, onClose }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const isMe = person.id === meId;
  const [tab, setTab] = useState<TabId>('about');
  const likeness =
    likenesses.find(
      (l) => (l.a === meId && l.b === person.id) || (l.b === meId && l.a === person.id),
    ) ?? null;
  const homes = person.homes.map((h) => h.name).join(' & ');

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      aria-labelledby="person-page-name"
    >
      <Box
        data-light-surface={person.remembered || undefined}
        sx={{
          position: 'relative',
          px: 3,
          pt: 4,
          pb: 2.5,
          bgcolor: person.remembered ? paper.paper : identityColor(person.id),
          color: person.remembered ? paper.ink : colors.onColor,
        }}
      >
        <IconButton
          aria-label="Close"
          onClick={onClose}
          sx={{ position: 'absolute', top: 8, right: 8, color: 'inherit' }}
        >
          <CloseIcon />
        </IconButton>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Face
            id={person.id}
            name={person.name}
            size={72}
            photo={photo}
            remembered={person.remembered}
          />
          <Box>
            <Typography
              id="person-page-name"
              sx={{
                fontSize: '1.6rem',
                fontWeight: 800,
                fontFamily: person.remembered ? paper.serif : undefined,
              }}
            >
              {person.name}
            </Typography>
            <Typography sx={{ opacity: 0.85 }}>
              {relationLabel(person.relation, isMe)}
              {homes && ` · ${homes}`}
            </Typography>
            {person.died && (
              <Typography sx={{ opacity: 0.85, fontStyle: 'italic' }}>
                Remembered since {person.died.slice(0, 4)}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
      <Tabs value={tab} onChange={(_, v: TabId) => setTab(v)} variant="fullWidth">
        <Tab value="about" label="About" />
        <Tab value="words" label="In their words" />
        {!isMe && <Tab value="you" label="You & them" />}
      </Tabs>
      <Box sx={{ p: 3 }}>
        {tab === 'about' && <About person={person} dedication={dedication} />}
        {tab === 'words' && <InTheirWords person={person} />}
        {tab === 'you' && !isMe && (
          <YouAndThem person={person} likeness={likeness} meIsA={likeness?.a === meId} />
        )}
      </Box>
    </Dialog>
  );
};
