/**
 * Welcome back (docs/decisions/0016): after a while away, what's new since,
 * in one line. Never what was missed; shown once per return.
 */
import type { SinceSummary } from '@family-trivia/shared';
import WavingHandRoundedIcon from '@mui/icons-material/WavingHandRounded';
import { Card, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { sinceApi } from '../api/sinceApi';

const names = (ids: string[], nameOf: (id: string) => string) =>
  ids.length <= 2
    ? ids.map(nameOf).join(' and ')
    : `${ids.slice(0, 2).map(nameOf).join(', ')} and ${ids.length - 2} more`;

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export const SinceCardView: React.FC<{
  since: SinceSummary | null;
  nameOf: (id: string) => string;
}> = ({ since, nameOf }) => {
  if (!since?.since) return null;
  const parts = [
    since.answeredBy.length ? `${names(since.answeredBy, nameOf)} shared answers` : null,
    since.comments || since.reactions
      ? [
          since.comments && plural(since.comments, 'comment'),
          since.reactions && plural(since.reactions, 'reaction'),
        ]
          .filter(Boolean)
          .join(' and ') + ' on yours'
      : null,
  ].filter(Boolean);
  const day = new Date(since.since).toLocaleDateString(undefined, { weekday: 'long' });
  return (
    <Card sx={{ p: 2, mb: 2, borderRadius: 3 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <WavingHandRoundedIcon sx={{ color: 'secondary.main' }} />
        <Typography>
          <b>Welcome back.</b>{' '}
          {parts.length ? `Since ${day}: ${parts.join(' · ')}.` : 'Good to see you.'}
        </Typography>
      </Stack>
    </Card>
  );
};

/** Home's welcome back, asked once as Home opens. */
export const SinceCard: React.FC<{ nameOf: (id: string) => string }> = ({ nameOf }) => {
  const [since, setSince] = useState<SinceSummary | null>(null);
  useEffect(() => {
    sinceApi
      .check()
      .then(setSince)
      .catch(() => setSince(null));
  }, []);
  return <SinceCardView since={since} nameOf={nameOf} />;
};
