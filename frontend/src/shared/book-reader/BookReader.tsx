/**
 * Reading a book in the app: one page at a time on cream paper, turned with
 * a swipe, the arrows or the keyboard, with the press's blank pages left
 * out. Any page, or all of them, can be shared as images sized for a feed.
 */
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import CollectionsIcon from '@mui/icons-material/Collections';
import IosShareIcon from '@mui/icons-material/IosShare';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { paper, usePaper } from '../design-system';
import { pageFileName } from './frame';
import { type OpenBook, openBook } from './pdf';
import { shareImages } from './share';

/** How far a swipe goes before it turns the page. */
const SWIPE = 50;

export const BookReader: React.FC<{ url: string; title: string; onClose: () => void }> = ({
  url,
  title,
  onClose,
}) => {
  const room = usePaper();
  const [book, setBook] = useState<OpenBook | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [sharing, setSharing] = useState<string | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    let open: OpenBook | null = null;
    let gone = false;
    openBook(url)
      .then((b) => {
        open = b;
        if (gone) b.close();
        else setBook(b);
      })
      .catch(() => !gone && setProblem('The book wouldn’t open. Try downloading it instead.'));
    return () => {
      gone = true;
      open?.close();
    };
  }, [url]);

  const count = book?.pages.length ?? 0;
  const turn = useCallback(
    (by: number) => setAt((a) => Math.max(0, Math.min(count - 1, a + by))),
    [count],
  );

  // Draw the page as wide as the room allows, keeping its 6 × 9 shape.
  useEffect(() => {
    const n = book?.pages[at];
    const box = stage.current;
    if (!book || !n || !canvas.current || !box) return;
    const width = Math.min(box.clientWidth - 24, ((box.clientHeight - 24) * 2) / 3, 640);
    book.draw(n, canvas.current, Math.max(200, width), paper.paper).catch(() => undefined);
  }, [book, at]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') turn(1);
      if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [turn]);

  const share = async (which: number[]) => {
    if (!book) return;
    const colors = { paper: paper.paper, table: paper.edge, shadow: paper.shadow };
    try {
      const files: File[] = [];
      for (const [i, n] of which.entries()) {
        setSharing(
          which.length > 1 ? `Making page ${i + 1} of ${which.length}…` : 'Making the image…',
        );
        const blob = await book.image(n, colors);
        const number = book.pages.indexOf(n) + 1;
        files.push(new File([blob], pageFileName(title, number, count), { type: 'image/png' }));
      }
      setSharing(null);
      await shareImages(files, title);
    } catch {
      setProblem('The images didn’t come together. Try again.');
    } finally {
      setSharing(null);
    }
  };

  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      slotProps={{ paper: { sx: { bgcolor: room.paper } } }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', px: 1.5, py: 1, gap: 1 }}>
          <Typography
            component="h2"
            noWrap
            sx={{ flex: 1, fontFamily: room.serif, fontSize: '1.15rem', color: room.ink }}
          >
            {title}
          </Typography>
          <IconButton aria-label="Close the book" onClick={onClose} sx={{ color: room.ink }}>
            <CloseIcon />
          </IconButton>
        </Stack>

        <Box
          ref={stage}
          onPointerDown={(e) => {
            swipe.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipe.current === null) return;
            const dx = e.clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > SWIPE) turn(dx < 0 ? 1 : -1);
          }}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'pan-y',
            position: 'relative',
          }}
        >
          {problem && <Alert severity="warning">{problem}</Alert>}
          {!book && !problem && <CircularProgress sx={{ color: room.inkSoft }} />}
          {book && (
            <>
              <canvas
                ref={canvas}
                aria-label={`Page ${at + 1} of ${count}`}
                style={{ boxShadow: `0 10px 30px ${room.shadow}`, borderRadius: 2 }}
              />
              <IconButton
                aria-label="Previous page"
                onClick={() => turn(-1)}
                disabled={at === 0}
                sx={{ position: 'absolute', left: 4, color: room.ink }}
              >
                <ChevronLeftIcon fontSize="large" />
              </IconButton>
              <IconButton
                aria-label="Next page"
                onClick={() => turn(1)}
                disabled={at >= count - 1}
                sx={{ position: 'absolute', right: 4, color: room.ink }}
              >
                <ChevronRightIcon fontSize="large" />
              </IconButton>
            </>
          )}
        </Box>

        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'center', gap: 1, p: 1.5, flexWrap: 'wrap' }}
        >
          {book && (
            <Typography sx={{ color: room.inkSoft, mr: 1 }}>
              {at + 1} of {count}
            </Typography>
          )}
          {sharing ? (
            <Typography sx={{ color: room.inkSoft }}>{sharing}</Typography>
          ) : (
            <>
              <Button
                startIcon={<IosShareIcon />}
                disabled={!book}
                onClick={() => book?.pages[at] && share([book.pages[at]])}
                sx={{ color: room.ink }}
              >
                Share this page
              </Button>
              <Button
                variant="outlined"
                startIcon={<CollectionsIcon />}
                disabled={!book}
                onClick={() => book && share(book.pages)}
                sx={{ color: room.ink, borderColor: room.rule }}
              >
                All {count || ''} pages as images
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </Dialog>
  );
};
