// SnakeGame — arcade-only trivia snake game.
//
// Classic Nokia Snake: collect LETTERS in order to spell trivia answers.
// Wrong letter = shrink. Complete words for points. Food for bonus growth.

import CloseIcon from '@mui/icons-material/Close';
import {
  Box, Button, IconButton, Typography,
  alpha, keyframes,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { submitArcadeScore } from '../../api/modules/arcade';
import { apiService } from '../../services/ApiService';
import { colors } from '../../shared/design-system/tokens/colors';
import { motion } from '../../shared/design-system/tokens/motion';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import GamePad from '../common/GamePad';
import { LoadingDots } from '../ui/feedback';

import type { GamePadButton } from '../common/GamePad';

const logger = createLogger('SnakeGame');

// ── Grid constants ────────────────────────────────────────────────
const COLS = 18;
const ROWS = 18;
const CELL_SIZE = 19;
const GRID_PX = COLS * CELL_SIZE; // 342px

// ── Timing ────────────────────────────────────────────────────────
const INITIAL_TICK_MS = 200;
const MIN_TICK_MS = 80;
const SPEED_UP_PER_WORD = 15; // ms faster every 2 words

// ── Scoring ───────────────────────────────────────────────────────
const POINTS_CORRECT_LETTER = 10;
const POINTS_WORD_COMPLETE_BASE = 50;
const POINTS_WORD_LENGTH_BONUS = 10;
const POINTS_FOOD = 5;
const POINTS_WRONG_LETTER = -5;

// ── Directions ────────────────────────────────────────────────────
type Direction = 'up' | 'down' | 'left' | 'right';

const DIR_DELTA: Record<Direction, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// ── Types ─────────────────────────────────────────────────────────
interface Coord { row: number; col: number; }

interface LetterCell {
  row: number;
  col: number;
  letter: string;
  isTarget: boolean; // is this the next letter to collect?
  isDecoy: boolean;  // random decoy letter
}

interface FoodCell { row: number; col: number; }

interface Question { clue: string; answer: string; }

/** Snapshot of game state for rendering. */
interface RenderSnapshot {
  snake: Coord[];
  direction: Direction;
  letters: LetterCell[];
  food: FoodCell[];
  score: number;
  currentClue: string;
  currentAnswer: string;
  collectedCount: number;
  wordsCompleted: number;
  totalWords: number;
}

interface SnakeGameProps {
  userId: string;
  mode?: 'arcade';
  onClose: () => void;
  onComplete?: (result: { correct: boolean; streak: number; pointsEarned: number }) => void;
}

// ── Helpers ───────────────────────────────────────────────────────

function coordKey(c: Coord): string {
  return `${c.row},${c.col}`;
}

function randomEmptyCell(occupied: Set<string>): Coord {
  let attempts = 0;
  while (attempts < 1000) {
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);
    if (!occupied.has(coordKey({ row, col }))) {
      return { row, col };
    }
    attempts++;
  }
  // Fallback: just return center-ish
  return { row: Math.floor(ROWS / 2), col: Math.floor(COLS / 2) };
}

function getOccupiedSet(snake: Coord[], letters: LetterCell[], food: FoodCell[]): Set<string> {
  const set = new Set<string>();
  for (const c of snake) set.add(coordKey(c));
  for (const l of letters) set.add(coordKey(l));
  for (const f of food) set.add(coordKey(f));
  return set;
}

function randomLetter(): string {
  return String.fromCharCode(65 + Math.floor(Math.random() * 26));
}

// ── Animations ────────────────────────────────────────────────────

const pulse = keyframes`
  0%   { opacity: 0.7; transform: scale(1); }
  50%  { opacity: 1;   transform: scale(1.2); }
  100% { opacity: 0.7; transform: scale(1); }
`;

const flashIn = keyframes`
  0%   { background-color: #fff; }
  100% { background-color: transparent; }
`;

const popUp = keyframes`
  0%   { opacity: 0; transform: translateY(10px) scale(0.7); }
  50%  { opacity: 1; transform: translateY(-5px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-20px) scale(1); }
`;

const resultPop = keyframes`
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;

// ── Component ─────────────────────────────────────────────────────

type GameState = 'loading' | 'idle' | 'playing' | 'gameOver';

const INITIAL_SNAKE: Coord[] = [
  { row: 10, col: 12 },
  { row: 10, col: 11 },
  { row: 10, col: 10 },
];

const INITIAL_SNAPSHOT: RenderSnapshot = {
  snake: INITIAL_SNAKE,
  direction: 'right',
  letters: [],
  food: [],
  score: 0,
  currentClue: '',
  currentAnswer: '',
  collectedCount: 0,
  wordsCompleted: 0,
  totalWords: 0,
};

const SnakeGame: React.FC<SnakeGameProps> = ({ userId, onClose, onComplete }) => {
  // ── UI state (causes re-renders) ──────────────────────────────
  const [gameState, setGameState] = useState<GameState>('loading');
  const [snapshot, setSnapshot] = useState<RenderSnapshot>(INITIAL_SNAPSHOT);
  const [flashCell, setFlashCell] = useState<string | null>(null);
  const [wordPopup, setWordPopup] = useState<string | null>(null);
  const [speedNotice, setSpeedNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Game engine refs ──────────────────────────────────────────
  const snakeRef = useRef<Coord[]>([...INITIAL_SNAKE]);
  const directionRef = useRef<Direction>('right');
  // 2-deep input buffer so rapid presses (e.g., right→down within one
  // tick) don't eat the first input. The game loop shifts one per tick.
  const inputBufferRef = useRef<Direction[]>([]);
  const scoreRef = useRef(0);
  const lettersRef = useRef<LetterCell[]>([]);
  const foodRef = useRef<FoodCell[]>([]);
  const questionsRef = useRef<Question[]>([]);
  const currentWordIndexRef = useRef(0);
  const collectedCountRef = useRef(0);
  const wordsCompletedRef = useRef(0);
  const tickIntervalRef = useRef(INITIAL_TICK_MS);
  const lastTickRef = useRef(0);
  const gameStateRef = useRef<GameState>('loading');
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Keep gameStateRef in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // ── Lock page scroll ──────────────────────────────────────────
  useEffect(() => {
    if (gameState === 'loading' || gameState === 'idle') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [gameState]);

  // ── Load questions ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiService.request<{ questions: Question[] }>(
          '/snake/questions',
          { method: 'POST', body: JSON.stringify({ userId }) },
        );
        if (cancelled) return;
        questionsRef.current = data.questions;
        setGameState('idle');
      } catch (err) {
        logger.error('Failed to load snake questions', err);
        if (!cancelled) setErrorMsg('Failed to load questions. Please try again.');
        setGameState('idle');
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Scatter letters for the current word ──────────────────────
  const scatterLetters = useCallback(() => {
    const qi = currentWordIndexRef.current;
    const questions = questionsRef.current;
    if (qi >= questions.length) return;

    const answer = questions[qi].answer;
    const occupied = getOccupiedSet(snakeRef.current, [], foodRef.current);
    const newLetters: LetterCell[] = [];

    // Place answer letters
    for (let i = 0; i < answer.length; i++) {
      const pos = randomEmptyCell(occupied);
      occupied.add(coordKey(pos));
      newLetters.push({
        ...pos,
        letter: answer[i],
        isTarget: i === 0,
        isDecoy: false,
      });
    }

    // Place 2-3 decoy letters
    const decoyCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < decoyCount; i++) {
      const pos = randomEmptyCell(occupied);
      occupied.add(coordKey(pos));
      newLetters.push({
        ...pos,
        letter: randomLetter(),
        isTarget: false,
        isDecoy: true,
      });
    }

    lettersRef.current = newLetters;
    collectedCountRef.current = 0;
  }, []);

  // ── Spawn food ────────────────────────────────────────────────
  const spawnFood = useCallback(() => {
    const occupied = getOccupiedSet(snakeRef.current, lettersRef.current, foodRef.current);
    const pos = randomEmptyCell(occupied);
    foodRef.current = [...foodRef.current, pos];
  }, []);

  const ensureFood = useCallback(() => {
    while (foodRef.current.length < 2) {
      spawnFood();
    }
  }, [spawnFood]);

  // ── Sync snapshot ─────────────────────────────────────────────
  const syncSnapshot = useCallback(() => {
    const qi = currentWordIndexRef.current;
    const q = questionsRef.current[qi];
    setSnapshot({
      snake: snakeRef.current.map(c => ({ ...c })),
      direction: directionRef.current,
      letters: lettersRef.current.map(l => ({ ...l })),
      food: foodRef.current.map(f => ({ ...f })),
      score: scoreRef.current,
      currentClue: q?.clue ?? '',
      currentAnswer: q?.answer ?? '',
      collectedCount: collectedCountRef.current,
      wordsCompleted: wordsCompletedRef.current,
      totalWords: questionsRef.current.length,
    });
  }, []);

  // ── Game over handler ─────────────────────────────────────────
  const handleGameOver = useCallback(async () => {
    setGameState('gameOver');
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const finalScore = scoreRef.current;
    try {
      await submitArcadeScore(userId, 'snake', finalScore);
      logger.info('Snake score submitted', { score: finalScore });
    } catch (err) {
      logger.error('Failed to submit snake score', err);
    }

    onComplete?.({
      correct: wordsCompletedRef.current > 0,
      streak: wordsCompletedRef.current,
      pointsEarned: finalScore,
    });
  }, [userId, onComplete]);

  // Store in ref for game loop access
  const handleGameOverRef = useRef(handleGameOver);
  useEffect(() => { handleGameOverRef.current = handleGameOver; }, [handleGameOver]);

  // ── Game loop ─────────────────────────────────────────────────
  const scatterLettersRef = useRef(scatterLetters);
  useEffect(() => { scatterLettersRef.current = scatterLetters; }, [scatterLetters]);

  const ensureFoodRef = useRef(ensureFood);
  useEffect(() => { ensureFoodRef.current = ensureFood; }, [ensureFood]);

  const syncSnapshotRef = useRef(syncSnapshot);
  useEffect(() => { syncSnapshotRef.current = syncSnapshot; }, [syncSnapshot]);

  const gameLoopRef = useRef<(now: number) => void>();
  useEffect(() => {
    gameLoopRef.current = (now: number) => {
      if (gameStateRef.current !== 'playing') return;

      if (now - lastTickRef.current < tickIntervalRef.current) {
        rafRef.current = requestAnimationFrame((t) => gameLoopRef.current?.(t));
        return;
      }
      lastTickRef.current = now;

      // Apply next buffered direction (or keep current)
      if (inputBufferRef.current.length > 0) {
        directionRef.current = inputBufferRef.current.shift()!;
      }

      const [dr, dc] = DIR_DELTA[directionRef.current];
      const head = snakeRef.current[0];
      const newHead: Coord = { row: head.row + dr, col: head.col + dc };

      // Wall collision
      if (newHead.row < 0 || newHead.row >= ROWS || newHead.col < 0 || newHead.col >= COLS) {
        handleGameOverRef.current();
        return;
      }

      // Self collision (skip tail which will be removed)
      const selfHit = snakeRef.current.some((seg, i) => {
        if (i === snakeRef.current.length - 1) return false; // tail moves away
        return seg.row === newHead.row && seg.col === newHead.col;
      });
      if (selfHit) {
        handleGameOverRef.current();
        return;
      }

      let grow = false;
      const headKey = coordKey(newHead);

      // Check letter collision
      const letterIdx = lettersRef.current.findIndex(
        l => l.row === newHead.row && l.col === newHead.col,
      );
      if (letterIdx !== -1) {
        const hitLetter = lettersRef.current[letterIdx];
        const answer = questionsRef.current[currentWordIndexRef.current]?.answer ?? '';
        const expectedLetter = answer[collectedCountRef.current];

        if (!hitLetter.isDecoy && hitLetter.letter === expectedLetter) {
          // Correct letter!
          scoreRef.current += POINTS_CORRECT_LETTER;
          collectedCountRef.current++;
          grow = true;

          // Remove collected letter from grid
          lettersRef.current = lettersRef.current.filter((_, i) => i !== letterIdx);

          // Update target: mark next letter as target
          const nextExpected = answer[collectedCountRef.current];
          if (nextExpected) {
            // Find the first non-decoy letter matching the next expected
            const nextTarget = lettersRef.current.find(
              l => !l.isDecoy && l.letter === nextExpected && !l.isTarget,
            );
            // Mark all as non-target first, then mark the correct one
            lettersRef.current = lettersRef.current.map(l => ({
              ...l,
              isTarget: false,
            }));
            if (nextTarget) {
              const ni = lettersRef.current.indexOf(nextTarget);
              lettersRef.current[ni] = { ...lettersRef.current[ni], isTarget: true };
            }
          }

          setFlashCell(headKey);
          setTimeout(() => setFlashCell(null), 200);

          // Word complete?
          if (collectedCountRef.current >= answer.length) {
            const bonus = POINTS_WORD_COMPLETE_BASE + answer.length * POINTS_WORD_LENGTH_BONUS;
            scoreRef.current += bonus;
            wordsCompletedRef.current++;

            setWordPopup(`+${bonus}`);
            setTimeout(() => setWordPopup(null), 1000);

            // Speed up every 2 words
            if (wordsCompletedRef.current % 2 === 0) {
              tickIntervalRef.current = Math.max(
                MIN_TICK_MS,
                tickIntervalRef.current - SPEED_UP_PER_WORD,
              );
              setSpeedNotice(true);
              setTimeout(() => setSpeedNotice(false), 1500);
            }

            // Next word
            currentWordIndexRef.current++;
            if (currentWordIndexRef.current < questionsRef.current.length) {
              scatterLettersRef.current();
            } else {
              // All words done — game over (win)
              handleGameOverRef.current();
              return;
            }
          }
        } else {
          // Wrong letter — shrink
          scoreRef.current += POINTS_WRONG_LETTER;
          if (scoreRef.current < 0) scoreRef.current = 0;

          // Remove the hit letter
          lettersRef.current = lettersRef.current.filter((_, i) => i !== letterIdx);

          // Replace with a new decoy if it was a decoy, or re-scatter the answer letter
          const occupied = getOccupiedSet(snakeRef.current, lettersRef.current, foodRef.current);
          occupied.add(headKey);
          const pos = randomEmptyCell(occupied);

          if (hitLetter.isDecoy) {
            lettersRef.current.push({
              ...pos,
              letter: randomLetter(),
              isTarget: false,
              isDecoy: true,
            });
          } else {
            // Put the answer letter back somewhere else
            lettersRef.current.push({
              ...pos,
              letter: hitLetter.letter,
              isTarget: hitLetter.isTarget,
              isDecoy: false,
            });
          }

          // Shrink snake (remove tail)
          if (snakeRef.current.length > 2) {
            // We'll shrink after moving (remove 2 from tail instead of 1)
            // Actually just set a flag to remove extra
            snakeRef.current = [newHead, ...snakeRef.current.slice(0, -2)];
            syncSnapshotRef.current();
            rafRef.current = requestAnimationFrame((t) => gameLoopRef.current?.(t));
            return;
          }
        }
      }

      // Check food collision
      const foodIdx = foodRef.current.findIndex(
        f => f.row === newHead.row && f.col === newHead.col,
      );
      if (foodIdx !== -1) {
        scoreRef.current += POINTS_FOOD;
        grow = true;
        foodRef.current = foodRef.current.filter((_, i) => i !== foodIdx);
        ensureFoodRef.current();
      }

      // Move snake
      const newSnake = [newHead, ...snakeRef.current];
      if (!grow) {
        newSnake.pop(); // remove tail
      }
      snakeRef.current = newSnake;

      // Die if too short
      if (snakeRef.current.length < 1) {
        handleGameOverRef.current();
        return;
      }

      syncSnapshotRef.current();
      rafRef.current = requestAnimationFrame((t) => gameLoopRef.current?.(t));
    };
  });

  // ── Start game ────────────────────────────────────────────────
  const startGame = useCallback(() => {
    if (questionsRef.current.length === 0) {
      setErrorMsg('No questions loaded. Please try again.');
      return;
    }

    snakeRef.current = [...INITIAL_SNAKE.map(c => ({ ...c }))];
    directionRef.current = 'right';
    inputBufferRef.current = [];
    scoreRef.current = 0;
    currentWordIndexRef.current = 0;
    collectedCountRef.current = 0;
    wordsCompletedRef.current = 0;
    tickIntervalRef.current = INITIAL_TICK_MS;
    foodRef.current = [];
    lettersRef.current = [];

    scatterLetters();
    ensureFood();

    setGameState('playing');
    setErrorMsg(null);
    setWordPopup(null);
    setSpeedNotice(false);

    lastTickRef.current = globalThis.performance.now();
    syncSnapshot();
    rafRef.current = requestAnimationFrame((t) => gameLoopRef.current?.(t));
  }, [scatterLetters, ensureFood, syncSnapshot]);

  // ── Cleanup RAF on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Queue a direction into the 2-deep input buffer.
  // Rejects: reversals (instant death) and duplicates (wastes a slot
  // and blocks the next real turn — the most likely cause of "I pressed
  // a button and nothing happened").
  const queueDirection = useCallback((newDir: Direction) => {
    const lastDir = inputBufferRef.current.length > 0
      ? inputBufferRef.current[inputBufferRef.current.length - 1]
      : directionRef.current;
    if (newDir === OPPOSITE[lastDir]) return;
    if (newDir === lastDir) return;
    if (inputBufferRef.current.length < 2) {
      inputBufferRef.current.push(newDir);
    } else {
      inputBufferRef.current[1] = newDir;
    }
  }, []);

  // ── Keyboard controls ─────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameStateRef.current !== 'playing') return;

      let newDir: Direction | null = null;
      switch (e.key) {
        case 'ArrowUp': newDir = 'up'; break;
        case 'ArrowDown': newDir = 'down'; break;
        case 'ArrowLeft': newDir = 'left'; break;
        case 'ArrowRight': newDir = 'right'; break;
        default: return;
      }

      e.preventDefault();
      if (newDir) queueDirection(newDir);
    };

    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [queueDirection]);

  // Controls: d-pad buttons (rendered below grid) + arrow keys (useEffect above)

  // ── Render helpers ────────────────────────────────────────────
  const { snake, letters, food, score, currentClue, currentAnswer, collectedCount, wordsCompleted, totalWords } = snapshot;

  const snakeSet = new Set(snake.map(coordKey));
  const headKey2 = snake.length > 0 ? coordKey(snake[0]) : '';
  const letterMap = new Map(letters.map(l => [coordKey(l), l]));
  const foodSet = new Set(food.map(coordKey));

  // Letter progress display
  const progressLetters = currentAnswer.split('').map((ch, i) => ({
    letter: ch,
    collected: i < collectedCount,
  }));

  // ── Render ────────────────────────────────────────────────────
  return (
    <Box
      ref={rootRef}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: GRID_PX + 32,
        mx: 'auto',
        userSelect: 'none',
        touchAction: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          background: `linear-gradient(135deg, ${colors.brand.primaryDark}, ${colors.brand.primary})`,
          borderRadius: `${radii.lg}px ${radii.lg}px 0 0`,
        }}
      >
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '1.1rem',
            color: colors.text.inverse,
            letterSpacing: 2,
            fontFamily: 'monospace',
          }}
        >
          SNAKE
        </Typography>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            color: colors.medal.gold,
            fontFamily: 'monospace',
          }}
        >
          {score}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: colors.text.inverse }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Clue bar */}
      {gameState === 'playing' && (
        <Box
          sx={{
            width: '100%',
            px: 1.5,
            py: 0.75,
            bgcolor: '#1a1a1a',
            borderBottom: '1px solid #333',
          }}
        >
          <Typography
            sx={{
              fontSize: '0.75rem',
              color: 'rgba(255,255,255,0.7)',
              mb: 0.5,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentClue}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ display: 'flex', gap: '3px', flex: 1 }}>
              {progressLetters.map((pl, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    color: pl.collected ? colors.brand.primaryLight : 'rgba(255,255,255,0.3)',
                    transition: `color ${motion.duration.fast} ${motion.ease.smooth}`,
                  }}
                >
                  {pl.collected ? pl.letter : '_'}
                </Typography>
              ))}
            </Box>
            <Typography
              sx={{
                fontSize: '0.65rem',
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'monospace',
              }}
            >
              Word {Math.min(wordsCompleted + 1, totalWords)}/{totalWords}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Game grid — uses plain div+style for cells to skip MUI emotion overhead.
          Only active cells are rendered (no 324-cell scan). */}
      <div
        style={{
          position: 'relative',
          width: GRID_PX,
          height: GRID_PX,
          backgroundColor: '#111',
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          contain: 'layout style paint',
        }}
      >
        {/* Snake body (not head) */}
        {snapshot.snake.slice(1).map((c, i) => (
          <div key={`s${i}`} style={{
            position: 'absolute',
            left: c.col * CELL_SIZE, top: c.row * CELL_SIZE,
            width: CELL_SIZE, height: CELL_SIZE,
            backgroundColor: '#4caf50', borderRadius: 2,
          }} />
        ))}

        {/* Head */}
        {snapshot.snake[0] && (() => {
          const h = snapshot.snake[0];
          const d = snapshot.direction;
          return (
            <div key="head" style={{
              position: 'absolute',
              left: h.col * CELL_SIZE, top: h.row * CELL_SIZE,
              width: CELL_SIZE, height: CELL_SIZE,
              backgroundColor: '#2e7d32', borderRadius: 3,
            }}>
              <div style={{
                position: 'absolute', width: 3, height: 3, borderRadius: '50%',
                backgroundColor: '#fff', top: 3,
                left: d === 'left' ? 2 : d === 'right' ? undefined : 3,
                right: d === 'right' ? 2 : undefined,
              }} />
              <div style={{
                position: 'absolute', width: 3, height: 3, borderRadius: '50%',
                backgroundColor: '#fff', bottom: 3,
                left: d === 'left' ? 2 : d === 'right' ? undefined : 3,
                right: d === 'right' ? 2 : undefined,
              }} />
            </div>
          );
        })()}

        {/* Letters (target / decoy / neutral) */}
        {snapshot.letters.map((lc, i) => {
          const isTarget = lc.isTarget;
          const bg = isTarget ? 'rgba(255,235,59,0.9)'
            : lc.isDecoy ? 'rgba(244,67,54,0.3)' : 'rgba(158,158,158,0.3)';
          return (
            <div key={`l${i}`} style={{
              position: 'absolute',
              left: lc.col * CELL_SIZE, top: lc.row * CELL_SIZE,
              width: CELL_SIZE, height: CELL_SIZE,
              backgroundColor: bg, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isTarget ? `${pulse} 1s ease-in-out infinite` : undefined,
            }}>
              <span style={{
                fontSize: CELL_SIZE - 4, fontWeight: 800, fontFamily: 'monospace',
                lineHeight: 1, color: isTarget ? '#000' : lc.isDecoy ? '#f44336' : '#ccc',
              }}>
                {lc.letter}
              </span>
            </div>
          );
        })}

        {/* Food */}
        {snapshot.food.map((f, i) => {
          const key = `${f.row},${f.col}`;
          if (snakeSet.has(key)) return null;
          if (letterMap.has(key)) return null;
          return (
            <div key={`f${i}`} style={{
              position: 'absolute',
              left: f.col * CELL_SIZE, top: f.row * CELL_SIZE,
              width: CELL_SIZE, height: CELL_SIZE,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: CELL_SIZE - 3, lineHeight: 1,
            }}>
              🍎
            </div>
          );
        })}

        {/* Word complete popup */}
        {wordPopup && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `${popUp} 1s ease-out forwards`,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <Typography
              sx={{
                fontSize: '1.5rem',
                fontWeight: 900,
                color: colors.medal.gold,
                textShadow: '0 0 10px rgba(255,215,0,0.5)',
                fontFamily: 'monospace',
              }}
            >
              {wordPopup}
            </Typography>
          </Box>
        )}

        {/* Speed notice */}
        {speedNotice && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              bgcolor: alpha('#ff9800', 0.9),
              px: 1.5,
              py: 0.5,
              borderRadius: `${radii.md}px`,
              zIndex: 10,
            }}
          >
            <Typography
              sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}
            >
              SPEED UP!
            </Typography>
          </Box>
        )}

        {/* Idle overlay */}
        {gameState === 'idle' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#000', 0.85),
              zIndex: 20,
              gap: 2,
            }}
          >
            {errorMsg ? (
              <>
                <Typography sx={{ color: colors.result.incorrect, fontSize: '0.85rem', textAlign: 'center', px: 2 }}>
                  {errorMsg}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  onClick={onClose}
                  sx={{ bgcolor: colors.brand.primary }}
                >
                  Back to Arcade
                </Button>
              </>
            ) : (
              <>
                <Typography
                  sx={{
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: colors.brand.primaryLight,
                    fontFamily: 'monospace',
                    letterSpacing: 2,
                  }}
                >
                  TRIVIA SNAKE
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: 'rgba(255,255,255,0.6)',
                    textAlign: 'center',
                    px: 2,
                    lineHeight: 1.4,
                  }}
                >
                  Collect letters in order to spell answers.{'\n'}
                  Wrong letters shrink you!
                </Typography>
                <Button
                  variant="contained"
                  onClick={startGame}
                  sx={{
                    bgcolor: colors.brand.primary,
                    fontWeight: 700,
                    px: 3,
                    '&:hover': { bgcolor: colors.brand.primaryDark },
                  }}
                >
                  Play
                </Button>
              </>
            )}
          </Box>
        )}

        {/* Loading overlay */}
        {gameState === 'loading' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#000', 0.85),
              zIndex: 20,
              gap: 2,
            }}
          >
            <LoadingDots />
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem' }}>
              Loading questions...
            </Typography>
          </Box>
        )}

        {/* Game Over overlay */}
        {gameState === 'gameOver' && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha('#000', 0.9),
              zIndex: 20,
              gap: 1.5,
              animation: `${resultPop} ${motion.duration.slow} ${motion.ease.bounce}`,
            }}
          >
            <Typography
              sx={{
                fontSize: '1.3rem',
                fontWeight: 900,
                color: colors.result.incorrect,
                fontFamily: 'monospace',
                letterSpacing: 3,
              }}
            >
              GAME OVER
            </Typography>
            <Typography
              sx={{
                fontSize: '1.8rem',
                fontWeight: 900,
                color: colors.medal.gold,
                fontFamily: 'monospace',
              }}
            >
              {score}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'monospace',
              }}
            >
              Words: {wordsCompleted}/{totalWords}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={startGame}
                sx={{
                  bgcolor: colors.brand.primary,
                  fontWeight: 700,
                  '&:hover': { bgcolor: colors.brand.primaryDark },
                }}
              >
                Play Again
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={onClose}
                sx={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: '#fff',
                  fontWeight: 700,
                  '&:hover': { borderColor: 'rgba(255,255,255,0.5)' },
                }}
              >
                Back to Arcade
              </Button>
            </Box>
          </Box>
        )}
      </div>

      {/* D-pad controls — GamePad validates opposite-direction presses */}
      {gameState === 'playing' && (
        <Box sx={{ bgcolor: '#0a0a0a' }}>
          <GamePad
            layout="dpad"
            accentColor="#1b5e20"
            buttons={[
              { id: 'up', label: '▲', onPress: () => queueDirection('up') },
              { id: 'left', label: '◄', onPress: () => queueDirection('left') },
              { id: 'right', label: '►', onPress: () => queueDirection('right') },
              { id: 'down', label: '▼', onPress: () => queueDirection('down') },
            ] satisfies GamePadButton[]}
          />
        </Box>
      )}
    </Box>
  );
};

export default SnakeGame;
