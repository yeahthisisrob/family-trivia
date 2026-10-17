/**
 * Reading a book in the app on cream paper: two facing pages at a time on
 * a wide screen, one on a phone, turned with a swipe, the arrows or the
 * keyboard, with the press's blank pages left out. The pages in view, or
 * the whole book, can be saved or sent as images: two pages to an image,
 * each only its words.
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
  useMediaQuery,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { paper, usePaper } from '../design-system';
import { pageFileName, spreads } from './frame';
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
  /** The first page in view, as an index into the reading pages. */
  const [at, setAt] = useState(0);
  const [sharing, setSharing] = useState<string | null>(null);
  const wide = useMediaQuery('(min-width: 720px) and (min-aspect-ratio: 5/4)');
  const left = useRef<HTMLCanvasElement>(null);
  const right = useRef<HTMLCanvasElement>(null);
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
  const pairs = useMemo(() => spreads(book?.pages ?? []), [book]);
  // What's on screen: the spread on a wide screen, the one page on a phone.
  const views = useMemo(
    () => (wide ? pairs : (book?.pages ?? []).map((n) => [n])),
    [wide, pairs, book],
  );
  const view = Math.max(
    0,
    views.findIndex((v) => v.includes(book?.pages[at] ?? -1)),
  );
  const inView = views[view] ?? [];
  const first = book ? book.pages.indexOf(inView[0] ?? -1) : 0;
  const turn = useCallback(
    (by: number) => {
      const next = views[Math.max(0, Math.min(views.length - 1, view + by))];
      if (next?.[0] !== undefined && book) setAt(book.pages.indexOf(next[0]));
    },
    [views, view, book],
  );

  // Draw the pages as large as the room allows, keeping their 6 × 9 shape.
  const shown = inView.join(',');
  useEffect(() => {
    const box = stage.current;
    if (!book || !box || !shown) return;
    const pages = shown.split(',').map(Number);
    const width = Math.min(
      (box.clientWidth - 24) / pages.length - 8,
      ((box.clientHeight - 24) * 2) / 3,
      640,
    );
    pages.forEach((n, i) => {
      const canvas = (i ? right : left).current;
      if (canvas) book.draw(n, canvas, Math.max(160, width), paper.paper).catch(() => undefined);
    });
  }, [book, shown]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') turn(1);
      if (e.key === 'ArrowLeft') turn(-1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [turn]);

  /** Each group of pages becomes one image, named by its first page. */
  const share = async (groups: number[][]) => {
    if (!book) return;
    try {
      const files: File[] = [];
      for (const [i, pages] of groups.entries()) {
        setSharing(
          groups.length > 1 ? `Making image ${i + 1} of ${groups.length}…` : 'Making the image…',
        );
        const blob = await book.image(pages, { paper: paper.paper, fold: paper.rule });
        const number = book.pages.indexOf(pages[0] ?? 0) + 1;
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
              <Stack direction="row" sx={{ gap: 0.5 }}>
                {inView.map((n, i) => (
                  <canvas
                    key={n}
                    ref={i ? right : left}
                    aria-label={`Page ${first + i + 1} of ${count}`}
                    style={{ boxShadow: `0 10px 30px ${room.shadow}`, borderRadius: 2 }}
                  />
                ))}
              </Stack>
              <IconButton
                aria-label="Previous page"
                onClick={() => turn(-1)}
                disabled={view === 0}
                sx={{ position: 'absolute', left: 4, color: room.ink }}
              >
                <ChevronLeftIcon fontSize="large" />
              </IconButton>
              <IconButton
                aria-label="Next page"
                onClick={() => turn(1)}
                disabled={view >= views.length - 1}
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
              {inView.length > 1 ? `${first + 1}–${first + 2}` : first + 1} of {count}
            </Typography>
          )}
          {sharing ? (
            <Typography sx={{ color: room.inkSoft }}>{sharing}</Typography>
          ) : (
            <>
              <Button
                startIcon={<IosShareIcon />}
                disabled={!book}
                onClick={() => {
                  // The image holds the page in view and the one it faces.
                  const pair = pairs.find((p) => p.includes(inView[0] ?? -1));
                  if (pair) share([pair]);
                }}
                sx={{ color: room.ink }}
              >
                Share these pages
              </Button>
              <Button
                variant="outlined"
                startIcon={<CollectionsIcon />}
                disabled={!book}
                onClick={() => share(pairs)}
                sx={{ color: room.ink, borderColor: room.rule }}
              >
                {count ? `All ${count} pages, ${pairs.length} images` : 'All the pages'}
              </Button>
            </>
          )}
        </Stack>
      </Stack>
    </Dialog>
  );
};
