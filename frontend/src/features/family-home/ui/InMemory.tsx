/** The people the family remembers, on paper: name, years, the family's own words. */
import type { FamilyPerson } from '@family-trivia/shared';
import { Box, ButtonBase, Typography } from '@mui/material';
import type React from 'react';
import { paper } from '../../../shared/design-system';
import { Face } from './Face';

export const InMemory: React.FC<{
  people: FamilyPerson[];
  photos: Record<string, string | undefined>;
  onOpen: (id: string) => void;
}> = ({ people, photos, onOpen }) => {
  if (!people.length) return null;
  return (
    <Box
      data-light-surface
      sx={{
        bgcolor: paper.paper,
        color: paper.ink,
        borderRadius: 2,
        p: { xs: 2.25, sm: 3 },
        boxShadow: `0 6px 18px ${paper.shadow}`,
        fontFamily: paper.serif,
      }}
    >
      <Typography
        sx={{
          fontFamily: paper.serif,
          fontStyle: 'italic',
          fontSize: '1.15rem',
          color: paper.inkSoft,
          mb: 1.5,
        }}
      >
        In memory of
      </Typography>
      {people.map((p) => (
        <ButtonBase
          key={p.id}
          onClick={() => onOpen(p.id)}
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            textAlign: 'left',
            py: 1,
            borderTop: `1px solid ${paper.rule}`,
            '&:first-of-type': { borderTop: 'none' },
          }}
        >
          <Face id={p.id} name={p.name} size={52} photo={photos[p.id]} remembered />
          <Box>
            <Typography sx={{ fontFamily: paper.serif, fontSize: '1.2rem', fontWeight: 700 }}>
              {p.name}
            </Typography>
            {p.memorial?.died && (
              <Typography
                sx={{ fontFamily: paper.serif, color: paper.inkSoft, fontSize: '0.9rem' }}
              >
                {p.born?.date ? `${p.born.date.slice(0, 4)} – ` : ''}
                {p.memorial.died.slice(0, 4)}
              </Typography>
            )}
            {p.memorial?.dedication && (
              <Typography sx={{ fontFamily: paper.serif, fontStyle: 'italic', mt: 0.25 }}>
                {p.memorial.dedication}
              </Typography>
            )}
          </Box>
        </ButtonBase>
      ))}
    </Box>
  );
};
