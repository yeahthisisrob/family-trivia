/**
 * Everyone, closest to the reader first, with a chip per home so a family
 * that lives in several houses can look at one at a time.
 */
import { Box, Card, CardActionArea, Chip, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useMemo, useState } from 'react';
import { type PersonView, relationLabel } from '../model/people';
import { Face } from './Face';

const statusOf = (p: PersonView): string | null =>
  p.remembered
    ? 'Remembered'
    : p.paused
      ? 'Taking a break'
      : p.notPlaying
        ? 'Not playing yet'
        : null;

const PersonCard: React.FC<{
  person: PersonView;
  meId: string | null;
  photo?: string;
  onOpen: (id: string) => void;
}> = ({ person: p, meId, photo, onOpen }) => {
  const status = statusOf(p);
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardActionArea
        onClick={() => onOpen(p.id)}
        sx={{ p: 1.5, height: '100%', display: 'flex', gap: 1.25, justifyContent: 'flex-start' }}
      >
        <Face
          id={p.id}
          name={p.name}
          size={44}
          photo={photo}
          remembered={p.remembered}
          dim={p.notPlaying}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>
            {p.name}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
            {relationLabel(p.relation, p.id === meId)} ·{' '}
            {status ?? (p.facts ? `${p.facts} answers` : 'no answers yet')}
          </Typography>
        </Box>
      </CardActionArea>
    </Card>
  );
};

export const PeopleSection: React.FC<{
  people: PersonView[];
  meId: string | null;
  photos: Record<string, string | undefined>;
  onOpen: (id: string) => void;
}> = ({ people, meId, photos, onOpen }) => {
  const [home, setHome] = useState<string | null>(null);
  const homes = useMemo(() => {
    const seen = new Map<string, string>();
    for (const p of people) for (const h of p.homes) seen.set(h.id, h.name);
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [people]);
  const shown = home ? people.filter((p) => p.homes.some((h) => h.id === home)) : people;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        Everyone
      </Typography>
      {homes.length > 1 && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          <Chip label="All" color={home ? 'default' : 'primary'} onClick={() => setHome(null)} />
          {homes.map((h) => (
            <Chip
              key={h.id}
              label={h.name}
              color={home === h.id ? 'primary' : 'default'}
              onClick={() => setHome(h.id)}
            />
          ))}
        </Stack>
      )}
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {shown.map((p) => (
          <PersonCard key={p.id} person={p} meId={meId} photo={photos[p.id]} onOpen={onOpen} />
        ))}
      </Box>
    </Box>
  );
};
