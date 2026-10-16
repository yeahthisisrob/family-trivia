/** The family in counted numbers: no AI, nothing guessed. */
import type { FamilyKnowledge } from '@family-trivia/shared';
import { Box, Card, Typography } from '@mui/material';
import type React from 'react';

const Num: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <Box>
    <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, lineHeight: 1.15 }}>{value}</Typography>
    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
      {label}
    </Typography>
  </Box>
);

export const ByTheNumbers: React.FC<{
  stats: FamilyKnowledge['stats'];
  nameOf: (id: string) => string;
}> = ({ stats: s, nameOf }) => {
  if (!s.answers) return null;
  // About 300 words to a printed page.
  const pages = Math.max(1, Math.round(s.words / 300));
  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.25 }}>
        By the numbers
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
        }}
      >
        <Num value={s.answers.toLocaleString()} label="answers in our own words" />
        <Num
          value={s.words.toLocaleString()}
          label={`words, about ${pages} ${pages === 1 ? 'page' : 'pages'}`}
        />
        {s.busiestDay && <Num value={s.busiestDay} label="the day we answer most" />}
        {s.longestAnswer && (
          <Num
            value={`${s.longestAnswer.words} words`}
            label={`${nameOf(s.longestAnswer.personId)}'s longest answer`}
          />
        )}
      </Box>
    </Card>
  );
};
