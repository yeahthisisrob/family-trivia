/**
 * Making a season into a book: choose how it's written, and get a 6 × 9 inch
 * PDF a printer takes as it is. The writing and the book are made once and
 * kept; making it again only happens when asked.
 */
import {
  BOOK_TONES,
  type BookTone,
  type BookVersion,
  type SeasonBook,
  type SeasonReview,
} from '@family-trivia/shared';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../../services/ApiService';
import { lookBackApi } from '../api/lookBackApi';

type Step = 'choose' | 'writing' | 'setting' | 'ready';

export const BookDialog: React.FC<{
  season: SeasonReview['season'];
  onClose: () => void;
}> = ({ season, onClose }) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [tone, setTone] = useState<BookTone>('warm');
  const [fresh, setFresh] = useState(false);
  const [step, setStep] = useState<Step>('choose');
  const [book, setBook] = useState<SeasonBook | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [versions, setVersions] = useState<BookVersion[]>([]);

  const loadVersions = useCallback(() => {
    lookBackApi
      .versions(season.number)
      .then(setVersions)
      .catch(() => undefined);
  }, [season.number]);
  useEffect(loadVersions, [loadVersions]);

  const make = async () => {
    setProblem(null);
    try {
      if (tone !== 'plain') {
        setStep('writing');
        await lookBackApi.writeBook(season.number, tone, fresh);
      }
      setStep('setting');
      setBook(await lookBackApi.makeBook(season.number, tone, fresh));
      setStep('ready');
      loadVersions();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : 'The book didn’t come together. Try again.');
      setStep('choose');
    }
  };

  const busy = step === 'writing' || step === 'setting';

  return (
    <Dialog
      open
      onClose={busy ? undefined : onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      aria-labelledby="book-title"
    >
      <Stack spacing={2.5} sx={{ p: 3 }}>
        <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography id="book-title" component="h2" sx={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {season.name}, as a book
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Every day’s question with everyone’s answers, set as a 6 × 9 inch book.
            </Typography>
          </Box>
          <IconButton aria-label="Close" onClick={onClose} disabled={busy}>
            <CloseIcon />
          </IconButton>
        </Stack>

        {step === 'choose' && (
          <>
            <Stack spacing={1} role="radiogroup" aria-label="How it’s written">
              {BOOK_TONES.map((t) => {
                const on = t.id === tone;
                return (
                  <Paper
                    key={t.id}
                    variant="outlined"
                    role="radio"
                    aria-checked={on}
                    tabIndex={0}
                    onClick={() => setTone(t.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setTone(t.id)}
                    sx={{
                      p: 1.75,
                      borderRadius: 2,
                      cursor: 'pointer',
                      borderColor: on ? 'primary.main' : 'divider',
                      borderWidth: on ? 2 : 1,
                    }}
                  >
                    <Typography sx={{ fontWeight: 700 }}>{t.label}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t.help}
                    </Typography>
                  </Paper>
                );
              })}
            </Stack>
            <FormControlLabel
              control={<Checkbox checked={fresh} onChange={(e) => setFresh(e.target.checked)} />}
              label={
                tone === 'plain'
                  ? 'Set it again, even if nothing changed'
                  : 'Write it again, even if it’s been written'
              }
            />
            {problem && <Alert severity="warning">{problem}</Alert>}
            <Button variant="contained" size="large" startIcon={<AutoStoriesIcon />} onClick={make}>
              Make the book
            </Button>
          </>
        )}

        {busy && (
          <Stack spacing={1.5} sx={{ py: 3 }}>
            <Typography sx={{ fontWeight: 700 }}>
              {step === 'writing'
                ? 'Writing the foreword and each month’s opening…'
                : 'Setting the pages…'}
            </Typography>
            <LinearProgress />
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {step === 'writing'
                ? 'This happens once; the book keeps what’s written. It can take half a minute.'
                : 'A few seconds.'}
            </Typography>
          </Stack>
        )}

        {step === 'ready' && book && (
          <Stack spacing={2}>
            <Alert severity="success">
              Your book is ready: {book.pages} pages
              {book.made ? '' : ', the copy we kept (nothing has changed since)'}.
            </Alert>
            <Button
              variant="contained"
              size="large"
              startIcon={<DownloadIcon />}
              href={book.url}
              target="_blank"
              rel="noopener"
            >
              Download the PDF
            </Button>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              To print it, upload the PDF to a print-on-demand press such as Lulu, Blurb or Amazon
              KDP as the inside of a 6 × 9 inch book. The type is embedded and the margins leave
              room for any binding; the press will help you make a cover.
            </Typography>
            <Button onClick={() => setStep('choose')}>Make another version</Button>
          </Stack>
        )}
        {!busy && versions.length > 0 && (
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>
              Every version, kept
            </Typography>
            <Stack spacing={0.5}>
              {versions.map((v) => (
                <Stack
                  key={`${v.tone}-${v.madeAt}`}
                  direction="row"
                  sx={{ alignItems: 'center', gap: 1 }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    {BOOK_TONES.find((t) => t.id === v.tone)?.label} · {v.pages} pages ·{' '}
                    {new Date(v.madeAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Typography>
                  <Button size="small" href={v.url} target="_blank" rel="noopener">
                    Download
                  </Button>
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Dialog>
  );
};
