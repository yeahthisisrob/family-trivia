/**
 * Someone's words as a printed book: one tap makes it (or hands back the
 * copy that's still current), and every version made is listed and kept.
 */
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import {
  Alert,
  Button,
  type ButtonProps,
  Dialog,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { ApiError } from '../../../shared/api/ApiService';
import { BookReader } from '../../../shared/book-reader';
import { type PersonBook, personBookApi } from '../api/personBookApi';

export const PersonBookButton: React.FC<{
  personId: string;
  name: string;
  label?: string;
  buttonSx?: ButtonProps['sx'];
}> = ({ personId, name, label = 'Make it a book', buttonSx }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [book, setBook] = useState<PersonBook | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [versions, setVersions] = useState<
    { madeAt: string; pages: number; url: string; coverUrl?: string }[]
  >([]);

  const make = async (fresh = false) => {
    setOpen(true);
    setBusy(true);
    setProblem(null);
    try {
      setBook(await personBookApi.make(personId, fresh));
      setVersions(await personBookApi.versions(personId).catch(() => []));
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : 'The book didn’t come together. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button startIcon={<AutoStoriesIcon />} onClick={() => make()} sx={buttonSx}>
        {label}
      </Button>
      {open && (
        <Dialog open onClose={busy ? undefined : () => setOpen(false)} fullWidth maxWidth="xs">
          <Stack spacing={2} sx={{ p: 3 }}>
            <Stack direction="row" sx={{ alignItems: 'flex-start' }}>
              <Typography component="h2" sx={{ flex: 1, fontSize: '1.3rem', fontWeight: 800 }}>
                {name}, in their own words
              </Typography>
              <IconButton aria-label="Close" onClick={() => setOpen(false)} disabled={busy}>
                <CloseIcon />
              </IconButton>
            </Stack>
            {busy && (
              <>
                <Typography>Setting the pages…</Typography>
                <LinearProgress />
              </>
            )}
            {problem && <Alert severity="warning">{problem}</Alert>}
            {book && !busy && (
              <>
                <Alert severity="success">
                  Ready: {book.pages} pages{book.made ? '' : ', the copy we kept'}.
                </Alert>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<MenuBookIcon />}
                  onClick={() => setReading(true)}
                >
                  Read it here
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  href={book.url}
                  target="_blank"
                  rel="noopener"
                >
                  Download the book
                </Button>
                {book.coverUrl && (
                  <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    href={book.coverUrl}
                    target="_blank"
                    rel="noopener"
                  >
                    Download its cover
                  </Button>
                )}
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  A 6 × 9 inch paperback and its cover, ready for a press such as Amazon KDP or
                  Lulu.
                </Typography>
                {versions.length > 1 && (
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Every version, kept
                    </Typography>
                    {versions.map((v) => (
                      <Stack key={v.madeAt} direction="row" sx={{ alignItems: 'center' }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {v.pages} pages ·{' '}
                          {new Date(v.madeAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </Typography>
                        <Button size="small" href={v.url} target="_blank" rel="noopener">
                          Book
                        </Button>
                        {v.coverUrl && (
                          <Button size="small" href={v.coverUrl} target="_blank" rel="noopener">
                            Cover
                          </Button>
                        )}
                      </Stack>
                    ))}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Dialog>
      )}
      {reading && book && (
        <BookReader
          url={book.url}
          title={`${name}, in their own words`}
          onClose={() => setReading(false)}
        />
      )}
    </>
  );
};
