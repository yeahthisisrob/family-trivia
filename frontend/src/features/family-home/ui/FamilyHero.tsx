/**
 * The top of the Family tab: the family's name, their story in a few
 * paragraphs, a handful of numbers, and everyone's face. It shows; it
 * doesn't ask anything of the reader.
 */
import { Box, ButtonBase, Card, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import type React from 'react';
import ReactMarkdown from 'react-markdown';
import type { FamilyStory } from '../api/familyHomeApi';
import type { PersonView } from '../model/people';
import { Face } from './Face';

const Stat: React.FC<{ value: string | number; label: string }> = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: '1.4rem', fontWeight: 800, lineHeight: 1.1 }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
  </Box>
);

export const FamilyHero: React.FC<{
  familyName: string;
  story: FamilyStory | null;
  people: PersonView[];
  photos: Record<string, string | undefined>;
  onOpen: (id: string) => void;
}> = ({ familyName, story, people, photos, onOpen }) => {
  const stats = story?.stats;
  const since = stats?.since?.slice(0, 4);
  return (
    <Card sx={{ p: { xs: 2.25, sm: 3 } }}>
      <Typography
        sx={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'primary.main',
        }}
      >
        Our family
      </Typography>
      <Typography
        component="h1"
        sx={{ fontSize: { xs: '1.6rem', sm: '2rem' }, fontWeight: 800, mt: 0.5 }}
      >
        {familyName}
      </Typography>

      <Box
        sx={{ mt: 1.5, '& p': { m: 0, mb: 1.25, lineHeight: 1.65 }, '& p:last-child': { mb: 0 } }}
      >
        {!story ? (
          <>
            <Skeleton width="100%" />
            <Skeleton width="85%" />
          </>
        ) : story.markdown ? (
          <ReactMarkdown>{story.markdown}</ReactMarkdown>
        ) : (
          <Typography sx={{ color: 'text.secondary' }}>
            Every answer anyone shares becomes part of this family's story. It's written here as it
            grows.
          </Typography>
        )}
      </Box>

      {stats && (
        <Stack direction="row" sx={{ gap: 3, mt: 2, flexWrap: 'wrap' }}>
          <Stat value={stats.people} label="people" />
          <Stat value={stats.households} label={stats.households === 1 ? 'home' : 'homes'} />
          <Stat value={stats.answers.toLocaleString()} label="answers shared" />
          {since && <Stat value={since} label="together here since" />}
        </Stack>
      )}

      {people.length > 0 && (
        <Stack direction="row" sx={{ mt: 2.5, gap: 0.75, overflowX: 'auto', pb: 0.5 }}>
          {people.map((p) => (
            <Tooltip key={p.id} title={p.name} arrow>
              <ButtonBase
                onClick={() => onOpen(p.id)}
                aria-label={p.name}
                sx={{ borderRadius: '50%', flexShrink: 0 }}
              >
                <Face
                  id={p.id}
                  name={p.name}
                  size={40}
                  photo={photos[p.id]}
                  remembered={p.remembered}
                  dim={p.notPlaying}
                />
              </ButtonBase>
            </Tooltip>
          ))}
        </Stack>
      )}
    </Card>
  );
};
