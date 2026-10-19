/**
 * Threads on Home (docs/decisions/0022): one "How do you know ...?" a day,
 * answered with a tap. Each answer ties a thread, and the line under it shows
 * the circle's web filling in. Nothing to fill out, nothing to learn.
 */
import type {
  ThreadAnswer,
  ThreadChoice,
  ThreadProgress,
  ThreadsToday,
} from '@family-trivia/shared';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import { Box, Button, Card, Chip, Fade, Stack, TextField, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type React from 'react';
import { useState } from 'react';
import { type Tied, useThreads } from '../model/useThreads';

const ProgressLine: React.FC<{ progress: ThreadProgress }> = ({ progress }) => {
  const theme = useTheme();
  const share = progress.pairs ? progress.tied / progress.pairs : 0;
  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        sx={{
          height: 6,
          borderRadius: 3,
          bgcolor: alpha(theme.palette.primary.main, 0.12),
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            height: '100%',
            width: `${Math.round(share * 100)}%`,
            bgcolor: 'primary.main',
            borderRadius: 3,
            transition: 'width 600ms ease',
          }}
        />
      </Box>
      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.5 }}>
        {progress.tied} of {progress.pairs} threads tied
      </Typography>
    </Box>
  );
};

interface ViewProps {
  today: ThreadsToday | null;
  tied: Tied | null;
  onAnswer: (a: ThreadAnswer) => Promise<void>;
}

/** The card itself, for stories and for the container below. */
export const ThreadCardView: React.FC<ViewProps> = ({ today, tied, onAnswer }) => {
  const theme = useTheme();
  const [picked, setPicked] = useState<ThreadChoice | null>(null);
  const [when, setWhen] = useState('');
  const [busy, setBusy] = useState(false);
  const question = today?.question;

  if (!question && !tied) return null;

  const send = async (choice: ThreadChoice, year?: string) => {
    if (!question) return;
    setBusy(true);
    try {
      await onAnswer({
        about: question.about.id,
        choice: choice.id,
        ...(year && /^\d{4}$/.test(year) ? { when: year } : {}),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      sx={{
        p: 2.5,
        mb: 2,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(theme.palette.secondary.main, 0.06)})`,
      }}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
        <HubRoundedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
        <Typography
          sx={{
            fontSize: '0.75rem',
            fontWeight: 700,
            letterSpacing: 1,
            textTransform: 'uppercase',
            color: 'primary.main',
          }}
        >
          Threads
        </Typography>
      </Stack>

      {tied ? (
        <Fade in>
          <Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AutoAwesomeRoundedIcon sx={{ color: 'secondary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Thread tied with {tied.name}
              </Typography>
            </Stack>
            <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
              {tied.label}. Another one tomorrow.
            </Typography>
            <ProgressLine progress={tied.progress} />
          </Box>
        </Fade>
      ) : (
        question && (
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
              {question.prompt}
            </Typography>
            {picked ? (
              <Stack spacing={1.5}>
                <Typography sx={{ color: 'text.secondary' }}>
                  {picked.label}. Roughly what year?
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <TextField
                    size="small"
                    placeholder="YYYY"
                    value={when}
                    autoFocus
                    onChange={(e) => setWhen(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    slotProps={{ htmlInput: { inputMode: 'numeric', 'aria-label': 'Year' } }}
                    sx={{ width: 110 }}
                  />
                  <Button
                    variant="contained"
                    disabled={busy || when.length !== 4}
                    onClick={() => void send(picked, when)}
                  >
                    Tie it
                  </Button>
                  <Button disabled={busy} onClick={() => void send(picked)}>
                    Not sure
                  </Button>
                </Stack>
              </Stack>
            ) : (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {question.choices.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    disabled={busy}
                    variant="outlined"
                    color="primary"
                    onClick={() => (c.asksWhen ? setPicked(c) : void send(c))}
                    sx={{ fontWeight: 600, bgcolor: 'background.paper' }}
                  />
                ))}
              </Box>
            )}
            {today && <ProgressLine progress={today.progress} />}
          </Box>
        )
      )}
    </Card>
  );
};

/** Home's card: today's thread from the server. */
export const ThreadCard: React.FC = () => {
  const { today, tied, answer } = useThreads();
  return <ThreadCardView today={today} tied={tied} onAnswer={answer} />;
};
