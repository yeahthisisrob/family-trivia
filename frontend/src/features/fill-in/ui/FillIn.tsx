/**
 * Your profile › Fill in your story. A small card says how full your answers
 * run next to the family's; Start opens a deck of flash cards, one question
 * at a time: write, save, next. Short answers get added to, and what they
 * said first is kept with its comments and reactions.
 */
import type { FillInItem, FillInView } from '@family-trivia/shared';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  Dialog,
  IconButton,
  Paper,
  Skeleton,
  Slide,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { knowledgeApi } from '../../../entities/family';
import { ApiError } from '../../../services/ApiService';
import { fillInApi } from '../api/fillInApi';

const PROMPT: Record<FillInItem['state'], string> = {
  missing: 'You missed this one',
  skipped: 'You skipped this one',
  brief: 'Say a little more?',
  full: '',
};

const DEPTH: Record<FillInView['summary']['depth'], string> = {
  shorter: 'Your answers run shorter than the family’s',
  similar: 'Your answers run about as full as the family’s',
  fuller: 'Your answers run fuller than most',
};

/** Two thin bars: your usual answer length and the family's. */
const DepthBars: React.FC<{ you: number; family: number }> = ({ you, family }) => {
  const max = Math.max(you, family, 1);
  const bar = (label: string, n: number, strong: boolean) => (
    <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
      <Typography variant="caption" sx={{ width: 52, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover' }}>
        <Box
          sx={{
            width: `${(n / max) * 100}%`,
            height: '100%',
            borderRadius: 3,
            bgcolor: strong ? 'primary.main' : 'text.disabled',
            transition: 'width 0.4s',
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ width: 28, textAlign: 'right', fontWeight: 700 }}>
        {n}
      </Typography>
    </Stack>
  );
  return (
    <Stack spacing={0.5} aria-label={`You usually write ${you} words; the family ${family}`}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Words in a usual answer
      </Typography>
      {bar('You', you, true)}
      {bar('Family', family, false)}
    </Stack>
  );
};

const Card: React.FC<{
  item: FillInItem;
  onSaved: () => void;
  onSkip: () => void;
}> = ({ item, onSaved, onSkip }) => {
  const [text, setText] = useState(item.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ready = !!text.trim() && text.trim() !== (item.answer ?? '').trim();

  const save = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await fillInApi.save(item.key, text);
      knowledgeApi.refreshMine();
      onSaved();
    } catch (e) {
      setProblem(e instanceof ApiError ? e.message : 'That didn’t save. Try again.');
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2} sx={{ flex: 1 }}>
      <Typography
        sx={{
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'primary.main',
        }}
      >
        {PROMPT[item.state]}
      </Typography>
      <Typography
        component="h2"
        sx={{ fontSize: { xs: '1.45rem', sm: '1.7rem' }, fontWeight: 800, lineHeight: 1.25 }}
      >
        {item.question}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {item.familyAnswered > 0
          ? `${item.familyAnswered} in the family answered${item.familyWords ? `, usually about ${item.familyWords} words` : ''}.`
          : 'Be the first to answer this one.'}
      </Typography>
      <TextField
        autoFocus
        fullWidth
        multiline
        minRows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void save();
        }}
        placeholder={item.state === 'brief' ? 'Add to what you said…' : 'Whatever comes to mind…'}
        slotProps={{ htmlInput: { maxLength: 2000, 'aria-label': item.question } }}
        sx={{ '& .MuiInputBase-root': { fontSize: '1.05rem', lineHeight: 1.55 } }}
      />
      {item.state === 'brief' && (
        <Typography variant="caption" sx={{ color: 'text.secondary', mt: -1 }}>
          What you said first is kept.
        </Typography>
      )}
      {problem && (
        <Typography variant="body2" sx={{ color: 'warning.main' }}>
          {problem}
        </Typography>
      )}
      <Box sx={{ flex: 1 }} />
      <Stack direction="row" sx={{ gap: 1 }}>
        <Button onClick={onSkip} disabled={busy} sx={{ flex: 1, minHeight: 48 }}>
          Not now
        </Button>
        <Button
          variant="contained"
          onClick={save}
          disabled={!ready || busy}
          sx={{ flex: 2, minHeight: 48 }}
        >
          {busy ? 'Saving…' : 'Save and next'}
        </Button>
      </Stack>
    </Stack>
  );
};

/** The deck: one card at a time, dots for where you are, a short done page. */
const Deck: React.FC<{ items: FillInItem[]; onClose: (savedAny: boolean) => void }> = ({
  items,
  onClose,
}) => {
  const theme = useTheme();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const [at, setAt] = useState(0);
  const [saved, setSaved] = useState(0);
  const done = at >= items.length;
  const current = items[at];
  const next = (didSave: boolean) => {
    if (didSave) setSaved((n) => n + 1);
    setAt((i) => i + 1);
  };

  return (
    <Dialog
      open
      fullScreen={phone}
      fullWidth
      maxWidth="sm"
      onClose={() => onClose(saved > 0)}
      aria-label="Fill in your story"
      slotProps={{ paper: { sx: { minHeight: { sm: 560 } } } }}
    >
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, pt: 1.5 }}>
        <Stack
          direction="row"
          sx={{ gap: 0.75, flex: 1 }}
          aria-label={`Card ${Math.min(at + 1, items.length)} of ${items.length}`}
        >
          {items.map((i, n) => (
            <Box
              key={i.key}
              sx={{
                width: n === at ? 22 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor:
                  n < at
                    ? 'primary.main'
                    : n === at
                      ? 'primary.light'
                      : 'action.disabledBackground',
                transition: 'all 0.25s',
              }}
            />
          ))}
        </Stack>
        <IconButton aria-label="Close" onClick={() => onClose(saved > 0)}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', p: { xs: 2.5, sm: 3 } }}>
        {done || !current ? (
          <Stack
            spacing={2}
            sx={{ flex: 1, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}
          >
            <AutoStoriesIcon sx={{ fontSize: 48, color: 'primary.main' }} />
            <Typography sx={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {saved ? `${saved} more for the family’s story` : 'Another time, then'}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {saved
                ? 'Thank you. They’re on the timeline now.'
                : 'These will be here when you want them.'}
            </Typography>
            <Button
              variant="contained"
              onClick={() => onClose(saved > 0)}
              sx={{ minHeight: 48, px: 4 }}
            >
              Done
            </Button>
          </Stack>
        ) : (
          <Slide key={current.key} direction="left" in appear={at > 0}>
            <Box sx={{ flex: 1, display: 'flex' }}>
              <Card item={current} onSaved={() => next(true)} onSkip={() => next(false)} />
            </Box>
          </Slide>
        )}
      </Box>
    </Dialog>
  );
};

export const FillIn: React.FC = () => {
  const [view, setView] = useState<FillInView | null>(null);
  const [failed, setFailed] = useState(false);
  const [deck, setDeck] = useState<FillInItem[] | null>(null);

  const load = useCallback(() => {
    fillInApi
      .view()
      .then(setView)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  if (failed) return null;
  if (!view) return <Skeleton variant="rounded" height={132} />;

  const s = view.summary;
  const cards = view.suggested
    .map((k) => view.items.find((i) => i.key === k))
    .filter((i): i is FillInItem => !!i);

  return (
    <Paper sx={{ p: 2.25 }}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }}>Fill in your story</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {s.answered} of {s.total} answered{s.familyWords > 0 ? ` · ${DEPTH[s.depth]}` : ''}
          </Typography>
        </Box>
        {cards.length > 0 && (
          <Button
            variant="contained"
            onClick={() => setDeck(cards)}
            sx={{ flexShrink: 0, minHeight: 44 }}
          >
            Start · {cards.length}
          </Button>
        )}
      </Stack>
      {s.familyWords > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <DepthBars you={s.yourWords} family={s.familyWords} />
        </Box>
      )}
      {deck && (
        <Deck
          items={deck}
          onClose={(savedAny) => {
            setDeck(null);
            if (savedAny) load();
          }}
        />
      )}
    </Paper>
  );
};
