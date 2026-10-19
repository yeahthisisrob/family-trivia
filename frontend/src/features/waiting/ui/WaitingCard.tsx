/**
 * What's waiting for you (docs/decisions/0016): trivia from days you didn't
 * play and past questions you haven't answered, in one line on Home. Nothing
 * expires while the season's open, so it says what's waiting, never what was
 * missed.
 */
import HourglassEmptyRoundedIcon from '@mui/icons-material/HourglassEmptyRounded';
import { Box, Button, Card, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type React from 'react';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const WaitingCard: React.FC<{
  trivia: number;
  questions: number;
  onPlay: () => void;
}> = ({ trivia, questions, onPlay }) => {
  const theme = useTheme();
  if (trivia + questions === 0) return null;
  const parts = [
    trivia ? plural(trivia, 'trivia question') : null,
    questions ? plural(questions, 'question for everyone', 'questions for everyone') : null,
  ].filter(Boolean);
  return (
    <Card sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <HourglassEmptyRoundedIcon sx={{ color: 'primary.main' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700 }}>Waiting for you: {parts.join(' and ')}</Typography>
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
    </Card>
  );
};
