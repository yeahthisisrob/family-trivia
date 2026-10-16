/**
 * What more than one person in the family talks about, from the knowledge
 * index: the thing, who, and a few of their own words.
 */
import { type FamilyTheme, KNOWLEDGE_KINDS } from '@family-trivia/shared';
import { AvatarGroup, Box, ButtonBase, Card, Typography } from '@mui/material';
import type React from 'react';
import { Face } from './Face';

const kindLabel = (k: string) => KNOWLEDGE_KINDS.find((x) => x.id === k)?.label ?? '';
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const WhatWeShare: React.FC<{
  themes: FamilyTheme[];
  nameOf: (id: string) => string;
  photos: Record<string, string | undefined>;
  onOpen: (id: string) => void;
}> = ({ themes, nameOf, photos, onOpen }) => {
  if (!themes.length) return null;
  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.25 }}>
        What we share
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.25 }}>
        Things more than one of us keeps coming back to
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 1.25,
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' },
        }}
      >
        {themes.slice(0, 6).map((t) => {
          const quote = t.quotes.find((q) => q.says);
          return (
            <Card
              key={`${t.kind}:${t.name}`}
              variant="outlined"
              sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}
            >
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {kindLabel(t.kind)}
              </Typography>
              <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{title(t.name)}</Typography>
              <AvatarGroup
                max={5}
                sx={{
                  justifyContent: 'flex-end',
                  '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.65rem' },
                }}
              >
                {t.people.map((id) => (
                  <ButtonBase
                    key={id}
                    onClick={() => onOpen(id)}
                    aria-label={nameOf(id)}
                    sx={{ borderRadius: '50%' }}
                  >
                    <Face id={id} name={nameOf(id)} size={26} photo={photos[id]} />
                  </ButtonBase>
                ))}
              </AvatarGroup>
              {quote && (
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary' }}>
                  “{quote.says}” · {nameOf(quote.personId)}
                </Typography>
              )}
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};
