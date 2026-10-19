/**
 * What someone loves, from their own answers (the knowledge index): grouped
 * by kind, in their words, with a "did you know" about each, and a way to go
 * further: tour dates for a band, the map for a place.
 */
import { KNOWLEDGE_KINDS, type Love } from '@family-trivia/shared';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { Box, Link, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type React from 'react';

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/** Where to go further, without any service to sign up for. */
function further(l: Love): { label: string; href: string } | null {
  if (l.tag === 'band') return { label: 'Tour dates', href: search(`${l.name} tour dates`) };
  if (l.kind === 'place')
    return {
      label: 'On the map',
      href: `https://www.google.com/maps/search/${encodeURIComponent(l.name)}`,
    };
  if (l.kind === 'media') return { label: 'Look it up', href: search(l.name) };
  return null;
}

const OneLove: React.FC<{ l: Love; color: string }> = ({ l, color }) => {
  const theme = useTheme();
  const go = further(l);
  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.75, borderRadius: 2, borderLeft: 3, borderLeftColor: color }}
    >
      <Stack
        direction="row"
        sx={{ alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '1.05rem' }}>{title(l.name)}</Typography>
        {l.count > 1 && (
          <Typography variant="caption" sx={{ color: 'text.secondary', flexShrink: 0 }}>
            came up {l.count} times
          </Typography>
        )}
      </Stack>
      {l.says[0] && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.25 }}>
          “{l.says[0]}”
        </Typography>
      )}
      {l.note && (
        <Box
          sx={{
            mt: 1,
            p: 1,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.07),
            display: 'flex',
            gap: 0.75,
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: 'primary.main', mt: '2px' }} />
          <Typography variant="body2">{l.note}</Typography>
        </Box>
      )}
      {go && (
        <Link
          href={go.href}
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 1, fontWeight: 600 }}
        >
          {go.label}
          <OpenInNewRoundedIcon sx={{ fontSize: 14 }} />
        </Link>
      )}
    </Paper>
  );
};

export const Loves: React.FC<{ loves: Love[]; color: string }> = ({ loves, color }) => {
  const groups = KNOWLEDGE_KINDS.map((k) => ({
    label: k.label,
    loves: loves.filter((l) => l.kind === k.id),
  })).filter((g) => g.loves.length);
  return (
    <Stack spacing={2}>
      {groups.map((g) => (
        <Box key={g.label}>
          <Typography
            sx={{
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: 'text.secondary',
              mb: 1,
            }}
          >
            {g.label}
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1.25,
              gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            }}
          >
            {g.loves.map((l) => (
              <OneLove key={`${l.kind}:${l.name}`} l={l} color={color} />
            ))}
          </Box>
        </Box>
      ))}
    </Stack>
  );
};
