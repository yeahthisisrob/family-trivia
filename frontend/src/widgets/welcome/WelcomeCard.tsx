/**
 * The top of Home (docs/decisions/0016): one card for coming back, with
 * what's new since (after a while away) and what's waiting for you, oldest
 * first. Nothing when there's nothing to say.
 */
import type { SinceSummary } from '@family-trivia/shared';
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import WavingHandRoundedIcon from '@mui/icons-material/WavingHandRounded';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type React from 'react';
import { sinceLine, useSince } from '../../features/since';
import { waitingLine } from '../../features/waiting';

interface ViewProps {
  since: SinceSummary | null;
  trivia: number;
  questions: number;
  nameOf: (id: string) => string;
  onPlay: () => void;
}

export const WelcomeCardView: React.FC<ViewProps> = ({
  since,
  trivia,
  questions,
  nameOf,
  onPlay,
}) => {
  const theme = useTheme();
  const back = sinceLine(since, nameOf);
  const waiting = waitingLine(trivia, questions);
  if (!back && !waiting) return null;
  return (
    <Card sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
      <Stack spacing={1.25}>
        {back && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <WavingHandRoundedIcon sx={{ color: 'secondary.main' }} />
            <Typography>
              <b>Welcome back.</b> {back}
            </Typography>
          </Stack>
        )}
        {waiting && (
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <HourglassEmptyRoundedIcon sx={{ color: 'primary.main' }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700 }}>Waiting for you: {waiting}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Oldest first, whenever you have a minute. Nothing expires this season.
              </Typography>
            </Box>
            {trivia > 0 && (
              <Button variant="contained" onClick={onPlay} sx={{ flexShrink: 0 }}>
                Play
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
};

export const WelcomeCard: React.FC<Omit<ViewProps, 'since'>> = (props) => (
  <WelcomeCardView since={useSince()} {...props} />
);
