/**
 * Scramble: a clue from the circle and its answer's letters, shuffled. Tap
 * them in order; a minute to get as many as you can. Built only from the game
 * kit, as an example of a game with no code outside its folder (0032).
 */
import type { GameClue } from '@family-trivia/shared';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, ButtonBase, Card, IconButton, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type GameProps, gameLook, getClues, submitScore, useGameSave } from '../kit';

const SECONDS = 60;
const look = gameLook(28);

const shuffle = (word: string): string[] => {
  const a = word.split('');
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j] as string, a[i] as string];
  }
  // Never hand over the answer already solved.
  return a.join('') === word && word.length > 1 ? shuffle(word) : a;
};

type Phase = 'loading' | 'ready' | 'playing' | 'done' | 'empty';

export interface ScrambleViewProps {
  clues: GameClue[];
  onClose: () => void;
  onFinish: (score: number) => void;
  /** The player's best so far (kept in their game save). */
  best?: number;
  /** For stories: start on the first clue. */
  autoStart?: boolean;
}

export const ScrambleView: React.FC<ScrambleViewProps> = ({
  clues,
  onClose,
  onFinish,
  best = 0,
  autoStart,
}) => {
  const [phase, setPhase] = useState<Phase>(clues.length ? 'ready' : 'empty');
  const [index, setIndex] = useState(0);
  const [tiles, setTiles] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(SECONDS);
  const [wrong, setWrong] = useState(false);
  const finished = useRef(false);
  // The best before this round: the save moves on as the round ends.
  const [before, setBefore] = useState(best);

  const clue = clues[index % Math.max(clues.length, 1)];

  const deal = useCallback(
    (i: number) => {
      const c = clues[i % clues.length];
      if (!c) return;
      setIndex(i);
      setTiles(shuffle(c.answer));
      setPicked([]);
      setWrong(false);
    },
    [clues],
  );

  const start = useCallback(() => {
    finished.current = false;
    setBefore(best);
    setScore(0);
    setLeft(SECONDS);
    deal(0);
    setPhase('playing');
  }, [deal, best]);

  useEffect(() => {
    if (autoStart && clues.length) start();
  }, [autoStart, clues.length, start]);

  useEffect(() => {
    if (phase !== 'playing') return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase === 'playing' && left === 0 && !finished.current) {
      finished.current = true;
      setPhase('done');
      onFinish(score);
    }
  }, [phase, left, score, onFinish]);

  const tap = (i: number) => {
    if (!clue || picked.includes(i)) return;
    const next = [...picked, i];
    setPicked(next);
    if (next.length < tiles.length) return;
    if (next.map((n) => tiles[n]).join('') === clue.answer) {
      setScore((s) => s + clue.answer.length * 10);
      deal(index + 1);
    } else {
      setWrong(true);
      setTimeout(() => {
        setPicked([]);
        setWrong(false);
      }, 500);
    }
  };

  return (
    <Card sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box
        sx={{
          background: look.gradient,
          color: 'common.white',
          px: 2,
          py: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Typography sx={{ fontWeight: 800, flex: 1 }}>Scramble</Typography>
        {phase === 'playing' && (
          <Typography sx={{ fontWeight: 800, mr: 1 }}>
            {score} · {left}s
          </Typography>
        )}
        <IconButton size="small" aria-label="Close" onClick={onClose} sx={{ color: 'inherit' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ p: 2.5, minHeight: 260 }}>
        {phase === 'empty' && (
          <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 6 }}>
            Not enough short answers here yet. Play a little trivia first!
          </Typography>
        )}

        {phase === 'ready' && (
          <Stack spacing={2} sx={{ alignItems: 'center', py: 4 }}>
            <Typography sx={{ textAlign: 'center' }}>
              Each clue comes from your own trivia and answers. Tap the letters in order.
            </Typography>
            {best > 0 && (
              <Typography sx={{ color: 'text.secondary' }}>Your best: {best}</Typography>
            )}
            <Button variant="contained" size="large" onClick={start} sx={{ borderRadius: 99 }}>
              Start
            </Button>
          </Stack>
        )}

        {phase === 'playing' && clue && (
          <Stack spacing={2.5} sx={{ alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 700, textAlign: 'center', minHeight: 48 }}>
              {clue.clue}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ minHeight: 44 }}>
              {picked.map((n, k) => (
                <Box
                  key={`${n}-${k}`}
                  sx={{
                    width: 36,
                    height: 44,
                    borderRadius: 1.5,
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                    bgcolor: wrong ? 'error.main' : 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  {tiles[n]}
                </Box>
              ))}
            </Stack>
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, justifyContent: 'center' }}>
              {tiles.map((letter, i) => {
                const used = picked.includes(i);
                return (
                  <ButtonBase
                    // biome-ignore lint/suspicious/noArrayIndexKey: letters repeat; position is the identity
                    key={i}
                    onClick={() => tap(i)}
                    disabled={used}
                    aria-label={letter}
                    sx={{
                      width: 44,
                      height: 52,
                      borderRadius: 1.5,
                      fontWeight: 800,
                      fontSize: '1.3rem',
                      border: 2,
                      borderColor: 'divider',
                      bgcolor: 'background.paper',
                      opacity: used ? 0.25 : 1,
                    }}
                  >
                    {letter}
                  </ButtonBase>
                );
              })}
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button color="inherit" onClick={() => setPicked([])}>
                Clear
              </Button>
              <Button color="inherit" onClick={() => deal(index + 1)}>
                Skip
              </Button>
            </Stack>
          </Stack>
        )}

        {phase === 'done' && (
          <Stack spacing={2} sx={{ alignItems: 'center', py: 4 }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>
              {score}
            </Typography>
            <Typography sx={{ color: 'text.secondary' }}>
              {score > before && before > 0
                ? 'A new best!'
                : before
                  ? `Your best: ${Math.max(before, score)}`
                  : 'points in a minute'}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={onClose}>Back</Button>
              <Button variant="contained" onClick={start}>
                Again
              </Button>
            </Stack>
          </Stack>
        )}
      </Box>
    </Card>
  );
};

/** The game: clues from the circle, the score to the board. */
const ScrambleGame: React.FC<GameProps> = ({ onClose }) => {
  const [clues, setClues] = useState<GameClue[] | null>(null);
  const [save, setSave] = useGameSave('scramble', { best: 0 });
  useEffect(() => {
    getClues({ count: 30, minLength: 4, maxLength: 7 })
      .then((c) => setClues(c.length >= 3 ? c : []))
      .catch(() => setClues([]));
  }, []);
  const finish = useCallback(
    (score: number) => {
      if (score > 0) submitScore('scramble', score).catch(() => undefined);
      if (score > save.best) setSave({ best: score });
    },
    [save.best, setSave],
  );
  if (!clues) return null;
  return <ScrambleView clues={clues} best={save.best} onClose={onClose} onFinish={finish} />;
};

export default ScrambleGame;
