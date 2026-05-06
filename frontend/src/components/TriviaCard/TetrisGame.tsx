// TetrisGame — weekly mobile game mode.
//
// Mechanics:
//  1. Play 60 seconds of classic Tetris on a 10×20 grid
//  2. Score determines multiplier: 0-499→1×, 500-999→2×, 1000+→3×
//  3. Multiplier is locked server-side, trivia question generated
//  4. Answer correctly to earn multiplier × base points

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box, Button, Card, IconButton, Typography,
  alpha, keyframes, useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { submitArcadeScore } from '../../api/modules/arcade';
import { lockTetris, submitTetrisAnswer } from '../../api/modules/games';
import { colors } from '../../shared/design-system/tokens/colors';
import { motion } from '../../shared/design-system/tokens/motion';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import GamePad from '../common/GamePad';
import { LoadingDots } from '../ui/feedback';

import type { GamePadButton } from '../common/GamePad';

import type { TetrisAnswerResult, TetrisLockResult } from '../../api/modules/games';

const logger = createLogger('TetrisGame');

// ── Grid constants ────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 22; // Compact for mobile — fits with controls + header in viewport

// ── Timing ────────────────────────────────────────────────────────
const GAME_DURATION_S = 60;
const INITIAL_TICK_MS = 800;
const MIN_TICK_MS = 100;
const SPEED_LINES_INTERVAL = 10; // speed up every N lines

// ── Scoring ───────────────────────────────────────────────────────
const LINE_SCORES: Record<number, number> = { 1: 100, 2: 300, 3: 500, 4: 800 };

function computeMultiplier(score: number): { multiplier: number; label: string; color: string } {
  if (score >= 1000) return { multiplier: 3, label: '3×', color: colors.medal.gold };
  if (score >= 500) return { multiplier: 2, label: '2×', color: colors.brand.primary };
  return { multiplier: 1, label: '1×', color: colors.brand.secondary };
}

// ── Tetromino definitions ─────────────────────────────────────────

// Each piece: array of rotation states, each state is array of [row, col] offsets
type PieceShape = number[][][];

const TETROMINOES: Record<string, PieceShape> = {
  I: [
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
    [[0,0],[0,1],[0,2],[0,3]],
    [[0,0],[1,0],[2,0],[3,0]],
  ],
  O: [
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
    [[0,0],[0,1],[1,0],[1,1]],
  ],
  T: [
    [[0,0],[0,1],[0,2],[1,1]],
    [[0,0],[1,0],[2,0],[1,1]],
    [[1,0],[1,1],[1,2],[0,1]],
    [[0,0],[1,0],[2,0],[1,-1]],
  ],
  S: [
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
    [[0,1],[0,2],[1,0],[1,1]],
    [[0,0],[1,0],[1,1],[2,1]],
  ],
  Z: [
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
    [[0,0],[0,1],[1,1],[1,2]],
    [[0,1],[1,0],[1,1],[2,0]],
  ],
  J: [
    [[0,0],[1,0],[1,1],[1,2]],
    [[0,0],[0,1],[1,0],[2,0]],
    [[0,0],[0,1],[0,2],[1,2]],
    [[0,0],[1,0],[2,0],[2,-1]],
  ],
  L: [
    [[0,2],[1,0],[1,1],[1,2]],
    [[0,0],[1,0],[2,0],[2,1]],
    [[0,0],[0,1],[0,2],[1,0]],
    [[0,0],[0,1],[1,1],[2,1]],
  ],
};

// NES-inspired piece colors
const PIECE_COLORS: Record<string, string> = {
  I: '#00f0f0', // cyan
  O: '#f0f000', // yellow
  T: '#a000f0', // purple
  S: '#00f000', // green
  Z: '#f00000', // red
  J: '#0000f0', // blue
  L: '#f0a000', // orange
};

const PIECE_KEYS = Object.keys(TETROMINOES);

// ── Type aliases ──────────────────────────────────────────────────
type Grid = (string | null)[][];
interface Piece { type: string; rotation: number; row: number; col: number; }

/** Snapshot of game state for rendering — avoids reading refs during render. */
interface RenderSnapshot {
  grid: Grid;
  piece: Piece;
  ghostRow: number;
  nextPiece: Piece;
}

// ── Helpers ───────────────────────────────────────────────────────

function createEmptyGrid(): Grid {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function getBlocks(piece: Piece): number[][] {
  return TETROMINOES[piece.type][piece.rotation].map(([r, c]) => [piece.row + r, piece.col + c]);
}

function isValid(piece: Piece, grid: Grid): boolean {
  return getBlocks(piece).every(([r, c]) =>
    r >= 0 && r < ROWS && c >= 0 && c < COLS && !grid[r][c],
  );
}

function computeGhostRow(piece: Piece, grid: Grid): number {
  let ghost = { ...piece };
  while (isValid({ ...ghost, row: ghost.row + 1 }, grid)) {
    ghost = { ...ghost, row: ghost.row + 1 };
  }
  return ghost.row;
}

function placePiece(piece: Piece, grid: Grid): Grid {
  const newGrid = grid.map(row => [...row]);
  const color = PIECE_COLORS[piece.type];
  getBlocks(piece).forEach(([r, c]) => {
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
      newGrid[r][c] = color;
    }
  });
  return newGrid;
}

function clearLines(grid: Grid): { grid: Grid; cleared: number; clearedRows: number[] } {
  const clearedRows: number[] = [];
  const remaining: (string | null)[][] = [];
  grid.forEach((row, i) => {
    if (row.every(cell => cell !== null)) {
      clearedRows.push(i);
    } else {
      remaining.push([...row]);
    }
  });
  const cleared = clearedRows.length;
  const emptyRows = Array.from({ length: cleared }, () => Array<string | null>(COLS).fill(null));
  return { grid: [...emptyRows, ...remaining], cleared, clearedRows };
}

function randomPiece(): Piece {
  const type = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { type, rotation: 0, row: 0, col: Math.floor((COLS - 2) / 2) };
}

function takeSnapshot(grid: Grid, piece: Piece, nextPiece: Piece): RenderSnapshot {
  return {
    grid: grid.map(row => [...row]),
    piece: { ...piece },
    ghostRow: computeGhostRow(piece, grid),
    nextPiece: { ...nextPiece },
  };
}

// ── Animations ────────────────────────────────────────────────────

const lineClearFlash = keyframes`
  0%   { background-color: #fff; }
  50%  { background-color: rgba(255,255,255,0.5); }
  100% { background-color: transparent; }
`;

const resultPop = keyframes`
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

// ── Component ─────────────────────────────────────────────────────

type GameState = 'idle' | 'playing' | 'gameOver' | 'locking' | 'question' | 'submitting' | 'answered';

interface TetrisGameProps {
  userId: string;
  /** 'trivia' = weekly with question, 'arcade' = unlimited, just scores */
  mode?: 'trivia' | 'arcade';
  isCatchingUp?: boolean;
  onClose: () => void;
  onComplete?: (result: { correct: boolean; streak: number; pointsEarned: number }) => void;
}

const INITIAL_SNAPSHOT: RenderSnapshot = {
  grid: createEmptyGrid(),
  piece: randomPiece(),
  ghostRow: 0,
  nextPiece: randomPiece(),
};

const TetrisGame: React.FC<TetrisGameProps> = ({ userId, mode = 'trivia', isCatchingUp = false, onClose, onComplete }) => {
  const theme = useTheme();

  // UI-visible state (causes re-renders)
  const [gameState, setGameState] = useState<GameState>('idle');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLines, setDisplayLines] = useState(0);
  const [timer, setTimer] = useState(GAME_DURATION_S);
  const [flashRows, setFlashRows] = useState<number[]>([]);
  const [snapshot, setSnapshot] = useState<RenderSnapshot>(INITIAL_SNAPSHOT);

  // Question/answer flow state
  const [question, setQuestion] = useState<TetrisLockResult['question'] | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<TetrisAnswerResult | null>(null);
  const [lockResult, setLockResult] = useState<TetrisLockResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Game engine refs (mutated every frame, no re-render)
  const gridRef = useRef<Grid>(createEmptyGrid());
  const pieceRef = useRef<Piece>(randomPiece());
  const nextPieceRef = useRef<Piece>(randomPiece());
  const scoreRef = useRef(0);
  const linesRef = useRef(0);
  const gameStateRef = useRef<GameState>('idle');
  const lastTickRef = useRef(0);
  const tickIntervalRef = useRef(INITIAL_TICK_MS);
  const timerStartRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Keep gameStateRef in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);


  // Lock page scroll while playing
  useEffect(() => {
    if (gameState === 'idle') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [gameState]);

  /** Push a render snapshot from the current refs into state. */
  const syncSnapshot = useCallback(() => {
    setSnapshot(takeSnapshot(gridRef.current, pieceRef.current, nextPieceRef.current));
  }, []);

  // ── Game engine ─────────────────────────────────────────────────

  const spawnPiece = useCallback(() => {
    pieceRef.current = { ...nextPieceRef.current };
    nextPieceRef.current = randomPiece();
    if (!isValid(pieceRef.current, gridRef.current)) {
      return false;
    }
    return true;
  }, []);

  const lockPiece = useCallback(() => {
    const piece = pieceRef.current;
    gridRef.current = placePiece(piece, gridRef.current);

    const { grid: newGrid, cleared, clearedRows } = clearLines(gridRef.current);
    if (cleared > 0) {
      setFlashRows(clearedRows);
      window.setTimeout(() => setFlashRows([]), 200);

      gridRef.current = newGrid;
      linesRef.current += cleared;
      scoreRef.current += LINE_SCORES[cleared] || 0;

      setDisplayScore(scoreRef.current);
      setDisplayLines(linesRef.current);

      const speedLevel = Math.floor(linesRef.current / SPEED_LINES_INTERVAL);
      tickIntervalRef.current = Math.max(MIN_TICK_MS, INITIAL_TICK_MS - speedLevel * 70);
    }

    if (!spawnPiece()) {
      setGameState('gameOver');
    }
    syncSnapshot();
  }, [spawnPiece, syncSnapshot]);

  const moveDown = useCallback(() => {
    const next = { ...pieceRef.current, row: pieceRef.current.row + 1 };
    if (isValid(next, gridRef.current)) {
      pieceRef.current = next;
      return true;
    }
    lockPiece();
    return false;
  }, [lockPiece]);

  const moveHorizontal = useCallback((dir: -1 | 1) => {
    const next = { ...pieceRef.current, col: pieceRef.current.col + dir };
    if (isValid(next, gridRef.current)) {
      pieceRef.current = next;
      syncSnapshot();
    }
  }, [syncSnapshot]);

  const rotate = useCallback(() => {
    const piece = pieceRef.current;
    const nextRotation = (piece.rotation + 1) % 4;
    const rotated = { ...piece, rotation: nextRotation };

    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      const kicked = { ...rotated, col: rotated.col + kick };
      if (isValid(kicked, gridRef.current)) {
        pieceRef.current = kicked;
        syncSnapshot();
        return;
      }
    }
  }, [syncSnapshot]);

  const hardDrop = useCallback(() => {
    const gr = computeGhostRow(pieceRef.current, gridRef.current);
    const rowsDropped = gr - pieceRef.current.row;
    scoreRef.current += rowsDropped * 2;
    setDisplayScore(scoreRef.current);
    pieceRef.current = { ...pieceRef.current, row: gr };
    lockPiece();
  }, [lockPiece]);

  // ── Main game loop ──────────────────────────────────────────────

  // Store moveDown in a ref so the loop closure always has the latest version
  const moveDownRef = useRef(moveDown);
  useEffect(() => { moveDownRef.current = moveDown; }, [moveDown]);

  const syncSnapshotRef = useRef(syncSnapshot);
  useEffect(() => { syncSnapshotRef.current = syncSnapshot; }, [syncSnapshot]);

  // Stable game loop function stored in a ref
  const gameLoopRef = useRef<(now: number) => void>();
  useEffect(() => {
    gameLoopRef.current = (now: number) => {
      if (gameStateRef.current !== 'playing') return;

      // Timer only in trivia mode — arcade is traditional (play until board fills)
      if (mode === 'trivia') {
        const elapsed = (now - timerStartRef.current) / 1000;
        const remaining = Math.max(0, GAME_DURATION_S - elapsed);
        setTimer(Math.ceil(remaining));

        if (remaining <= 0) {
          setGameState('gameOver');
          return;
        }
      }

      if (now - lastTickRef.current >= tickIntervalRef.current) {
        lastTickRef.current = now;
        moveDownRef.current();
        syncSnapshotRef.current();
      }

      rafRef.current = requestAnimationFrame((t) => gameLoopRef.current?.(t));
    };
  });

  const startGame = useCallback(() => {
    gridRef.current = createEmptyGrid();
    scoreRef.current = 0;
    linesRef.current = 0;
    tickIntervalRef.current = INITIAL_TICK_MS;
    pieceRef.current = randomPiece();
    nextPieceRef.current = randomPiece();

    setDisplayScore(0);
    setDisplayLines(0);
    setTimer(GAME_DURATION_S);
    setGameState('playing');
    setSnapshot(takeSnapshot(gridRef.current, pieceRef.current, nextPieceRef.current));

    timerStartRef.current = globalThis.performance.now();
    lastTickRef.current = globalThis.performance.now();
    rafRef.current = requestAnimationFrame((t) => gameLoopRef.current?.(t));
  }, []);

  // Cleanup RAF on unmount
  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Keyboard controls ───────────────────────────────────────────

  useEffect(() => {
    if (gameState !== 'playing') return;
    const handleKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          moveHorizontal(-1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveHorizontal(1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          moveDown();
          syncSnapshotRef.current();
          break;
        case 'ArrowUp':
          e.preventDefault();
          rotate();
          break;
        case ' ':
          e.preventDefault();
          hardDrop();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, moveHorizontal, moveDown, rotate, hardDrop]);

  // ── Game over → stop loop ───────────────────────────────────────

  useEffect(() => {
    if (gameState !== 'gameOver') return;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // In arcade mode, submit score immediately (no question flow)
    if (mode === 'arcade') {
      submitArcadeScore(userId, 'tetris', scoreRef.current).catch(err =>
        logger.error('Arcade score submit failed', err),
      );
    }
  }, [gameState, mode, userId]);

  const handleContinue = useCallback(async () => {
    const { multiplier } = computeMultiplier(scoreRef.current);
    setGameState('locking');
    try {
      const result = await lockTetris(userId, scoreRef.current, multiplier, isCatchingUp);
      setLockResult(result);
      setQuestion(result.question);
      setGameState('question');
    } catch (err) {
      logger.error('Tetris lock failed', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to lock score');
      window.setTimeout(() => onClose(), 2000);
    }
  }, [userId, isCatchingUp, onClose]);

  // ── Answer submission ───────────────────────────────────────────

  const handleAnswer = useCallback(async (answer: string) => {
    if (gameState !== 'question' || selectedAnswer) return;
    setSelectedAnswer(answer);
    setGameState('submitting');
    try {
      const res = await submitTetrisAnswer(userId, answer);
      setAnswerResult(res);
      setGameState('answered');
      window.setTimeout(() => {
        onComplete?.({
          correct: res.correct,
          streak: 0,
          pointsEarned: res.pointsEarned + (res.highScoreBonus || 0),
        });
      }, 2200);
    } catch (err) {
      logger.error('Tetris answer submit failed', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit answer');
      window.setTimeout(() => onClose(), 2000);
    }
  }, [gameState, selectedAnswer, userId, onComplete, onClose]);

  // ── Render derived values (from snapshot state, not refs) ───────

  const { grid, piece, ghostRow: ghostR, nextPiece } = snapshot;
  const activeBlocks = gameState === 'playing' ? getBlocks(piece) : [];
  const ghostBlocks = gameState === 'playing'
    ? getBlocks({ ...piece, row: ghostR })
    : [];

  const multInfo = computeMultiplier(displayScore);

  const nextBlocks = TETROMINOES[nextPiece.type][0];
  const nextColor = PIECE_COLORS[nextPiece.type];

  const timerColor = timer <= 10
    ? theme.palette.error.main
    : timer <= 20
      ? colors.brand.secondary
      : colors.text.primary;

  const resultColor = multInfo.color;

  return (
    <Card ref={rootRef} sx={{
      overflow: 'hidden', borderRadius: 3,
      border: `2px solid ${alpha('#7c4dff', 0.5)}`,
      boxShadow: `0 0 20px ${alpha('#7c4dff', 0.15)}`,
      scrollMarginTop: 16,
    }}>
      {/* Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #311b92 0%, #4a148c 100%)',
        color: 'white', px: 2, py: 1,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <Typography sx={{ fontWeight: 900, fontSize: '0.95rem', letterSpacing: 2 }}>
          TETRIS
        </Typography>
        <Box sx={{ flex: 1 }} />

        {(gameState === 'playing' || gameState === 'gameOver') && (
          <>
            {/* Score */}
            <Box sx={{ textAlign: 'center', minWidth: 60 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 600, opacity: 0.7, letterSpacing: 1 }}>
                SCORE
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 900, lineHeight: 1 }}>
                {displayScore}
              </Typography>
            </Box>
            {/* Lines */}
            <Box sx={{ textAlign: 'center', minWidth: 36 }}>
              <Typography sx={{ fontSize: '0.5rem', fontWeight: 600, opacity: 0.7, letterSpacing: 1 }}>
                LINES
              </Typography>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 900, lineHeight: 1 }}>
                {displayLines}
              </Typography>
            </Box>
            {/* Timer — trivia mode only */}
            {mode === 'trivia' && (
              <Box sx={{ textAlign: 'center', minWidth: 36 }}>
                <Typography sx={{ fontSize: '0.5rem', fontWeight: 600, opacity: 0.7, letterSpacing: 1 }}>
                  TIME
                </Typography>
                <Typography sx={{
                  fontSize: '0.85rem', fontWeight: 900, lineHeight: 1,
                  color: timerColor,
                }}>
                  {timer}s
                </Typography>
              </Box>
            )}
          </>
        )}

        <IconButton size="small" onClick={onClose} sx={{ color: 'white', p: 0.5 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* ── Idle screen ──────────────────────────────────────────── */}
      {gameState === 'idle' && (
        <Box sx={{ p: 3, textAlign: 'center', bgcolor: '#1a0a2e' }}>
          <Typography sx={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', mb: 0.5, letterSpacing: 2 }}>
            TETRIS
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: alpha('#fff', 0.7), mb: 2, lineHeight: 1.5 }}>
            {mode === 'arcade'
              ? 'Classic Tetris — play until you can\'t!'
              : 'Clear lines in 60 seconds to earn your multiplier!'}
          </Typography>
          {mode === 'trivia' && (
            <Box sx={{
              display: 'flex', justifyContent: 'center', gap: 2, mb: 2.5,
              fontSize: '0.65rem', color: alpha('#fff', 0.5),
            }}>
              <Box>0-499 = 1x</Box>
              <Box>500-999 = 2x</Box>
              <Box>1000+ = 3x</Box>
            </Box>
          )}
          <Button
            fullWidth variant="contained"
            onClick={startGame}
            sx={{
              py: 1.5, borderRadius: `${radii.md}px`,
              fontWeight: 800, fontSize: '0.95rem', letterSpacing: 1,
              background: 'linear-gradient(135deg, #7c4dff, #651fff)',
              '&:hover': { background: 'linear-gradient(135deg, #651fff, #6200ea)' },
            }}
          >
            START GAME
          </Button>
        </Box>
      )}

      {/* ── Playing / Game Over grid ─────────────────────────────── */}
      {(gameState === 'playing' || gameState === 'gameOver') && (
        <Box sx={{ bgcolor: '#0a0a0a', position: 'relative' }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
            {/* Main grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
              gap: '1px',
              backgroundColor: alpha('#fff', 0.04),
              border: `2px solid ${alpha('#7c4dff', 0.3)}`,
              position: 'relative',
              contain: 'layout style paint',
            }}>
              {grid.map((row, r) =>
                row.map((cell, c) => {
                  const isActive = activeBlocks.some(([br, bc]) => br === r && bc === c);
                  const isGhost = !isActive && ghostBlocks.some(([br, bc]) => br === r && bc === c);
                  const isFlashing = flashRows.includes(r);

                  const cellColor = isActive
                    ? PIECE_COLORS[piece.type]
                    : cell;

                  const bg = cellColor
                    ? cellColor
                    : isGhost
                      ? alpha(PIECE_COLORS[piece.type], 0.2)
                      : alpha('#fff', 0.02);

                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        width: CELL_SIZE, height: CELL_SIZE,
                        backgroundColor: bg,
                        borderRadius: 2,
                        boxShadow: cellColor
                          ? `inset 0 0 0 1px ${alpha('#fff', 0.2)}, inset 2px 2px 0 ${alpha('#fff', 0.15)}`
                          : undefined,
                        border: isGhost && !cellColor
                          ? `1px dashed ${alpha(PIECE_COLORS[piece.type], 0.35)}`
                          : undefined,
                        animation: isFlashing
                          ? `${lineClearFlash} 200ms ease-out`
                          : undefined,
                      }}
                    />
                  );
                }),
              )}
            </div>

            {/* Next piece preview */}
            <Box sx={{ ml: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 0.5 }}>
              <Typography sx={{
                fontSize: '0.5rem', fontWeight: 700, color: alpha('#fff', 0.5),
                letterSpacing: 1, mb: 0.5,
              }}>
                NEXT
              </Typography>
              <Box sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 16px)',
                gridTemplateRows: 'repeat(4, 16px)',
                gap: '1px',
              }}>
                {Array.from({ length: 16 }).map((_, i) => {
                  const r = Math.floor(i / 4);
                  const c = i % 4;
                  const isBlock = nextBlocks.some(([br, bc]) => br === r && bc === c);
                  return (
                    <Box key={i} sx={{
                      width: 16, height: 16,
                      bgcolor: isBlock ? nextColor : 'transparent',
                      borderRadius: '1px',
                      ...(isBlock && {
                        boxShadow: `inset 0 0 0 1px ${alpha('#fff', 0.2)}`,
                      }),
                    }} />
                  );
                })}
              </Box>

              {/* Multiplier progress */}
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography sx={{
                  fontSize: '0.5rem', fontWeight: 700, color: alpha('#fff', 0.5),
                  letterSpacing: 1, mb: 0.25,
                }}>
                  MULT
                </Typography>
                <Typography sx={{
                  fontSize: '1.2rem', fontWeight: 900,
                  color: multInfo.color,
                }}>
                  {multInfo.label}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Game over overlay */}
          {gameState === 'gameOver' && (
            <Box sx={{
              position: 'absolute', inset: 0,
              bgcolor: alpha('#000', 0.7),
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              animation: `${resultPop} 500ms ${motion.ease.bounce}`,
              zIndex: 10,
            }}>
              <Box sx={{
                bgcolor: '#1a0a2e', borderRadius: 3, px: 3, py: 2.5,
                textAlign: 'center', minWidth: 200,
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                border: `3px solid ${resultColor}`,
              }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: alpha('#fff', 0.6), letterSpacing: 1, mb: 0.5 }}>
                  GAME OVER
                </Typography>
                <Typography sx={{
                  fontSize: '2rem', fontWeight: 900, lineHeight: 1,
                  color: '#fff', mb: 0.5,
                }}>
                  {displayScore}
                </Typography>
                <Typography sx={{
                  fontSize: '0.65rem', fontWeight: 600,
                  color: alpha('#fff', 0.5), mb: 1,
                }}>
                  {displayLines} line{displayLines !== 1 ? 's' : ''} cleared
                </Typography>
                <Box sx={{
                  px: 1.5, py: 0.5, borderRadius: 2,
                  bgcolor: alpha(resultColor, 0.2),
                  border: `2px solid ${resultColor}`,
                  display: 'inline-block', mb: 2,
                }}>
                  <Typography sx={{
                    fontSize: '1.4rem', fontWeight: 900,
                    color: resultColor,
                    ...(multInfo.multiplier >= 3 && {
                      background: 'linear-gradient(90deg, #ffd700, #ffa000, #ffd700)',
                      backgroundSize: '200% auto',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: `${shimmer} 2s linear infinite`,
                    }),
                  }}>
                    {multInfo.label}
                  </Typography>
                </Box>
                {mode === 'arcade' ? (
                  <>
                    <Button
                      fullWidth variant="contained"
                      onClick={startGame}
                      sx={{
                        py: 1.25, borderRadius: `${radii.md}px`,
                        fontWeight: 700, fontSize: '0.85rem', mb: 0.75,
                        background: 'linear-gradient(135deg, #7c4dff, #651fff)',
                        '&:hover': { background: 'linear-gradient(135deg, #651fff, #6200ea)' },
                      }}
                    >
                      Play Again
                    </Button>
                    <Button
                      fullWidth variant="outlined" size="small"
                      onClick={onClose}
                      sx={{
                        borderRadius: `${radii.md}px`, fontSize: '0.75rem',
                        color: alpha('#fff', 0.7), borderColor: alpha('#fff', 0.2),
                      }}
                    >
                      Back to Arcade
                    </Button>
                  </>
                ) : (
                  <Button
                    fullWidth variant="contained"
                    onClick={handleContinue}
                    sx={{
                      py: 1.25, borderRadius: `${radii.md}px`,
                      fontWeight: 700, fontSize: '0.85rem',
                      background: 'linear-gradient(135deg, #7c4dff, #651fff)',
                      '&:hover': { background: 'linear-gradient(135deg, #651fff, #6200ea)' },
                    }}
                  >
                    Continue to Question &rarr;
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* ── Touch controls — left/right repeat on hold ──────────── */}
      {gameState === 'playing' && (
        <Box sx={{ bgcolor: '#0a0a0a' }}>
          <GamePad
            layout="bar"
            accentColor="#5e35b1"
            buttons={[
              { id: 'left', label: '\u25C4', onPress: () => moveHorizontal(-1), repeat: true },
              { id: 'rotate', label: '\u21BB', onPress: rotate },
              { id: 'right', label: '\u25BA', onPress: () => moveHorizontal(1), repeat: true },
              { id: 'drop', label: '\u25BC', onPress: hardDrop },
            ] satisfies GamePadButton[]}
          />
        </Box>
      )}

      {/* ── Question panel ───────────────────────────────────────── */}
      {(gameState === 'locking' || gameState === 'question' || gameState === 'submitting' || gameState === 'answered') && (
        <Box sx={{ p: 2, bgcolor: '#f5f0ff', borderBottom: `1px solid ${alpha('#7c4dff', 0.15)}` }}>
          {/* Multiplier chip + category */}
          <Box sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            mb: 1.5,
          }}>
            <Box sx={{
              px: 1.25, py: 0.35, borderRadius: 2,
              bgcolor: resultColor, color: '#fff',
              fontWeight: 900, fontSize: '0.85rem', letterSpacing: 0.3,
              boxShadow: `0 2px 8px ${alpha(resultColor, 0.4)}`,
            }}>
              {multInfo.label} LOCKED
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{
                fontSize: '0.7rem', fontWeight: 800, color: 'text.secondary',
              }}>
                Score: {displayScore}
              </Typography>
              {question && (
                <Typography sx={{
                  fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {question.category}
                </Typography>
              )}
            </Box>
          </Box>

          {gameState === 'locking' && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1, fontWeight: 600 }}>
                Generating your question...
              </Typography>
              <LoadingDots />
            </Box>
          )}

          {(gameState === 'question' || gameState === 'submitting' || gameState === 'answered') && question && (
            <>
              <Typography sx={{
                fontSize: '0.95rem', fontWeight: 600, lineHeight: 1.4,
                color: 'text.primary', mb: 1.5,
              }}>
                {question.question}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {question.choices.map((choice) => {
                  const isSelected = selectedAnswer === choice;
                  const isCorrect = gameState === 'answered' && answerResult?.correctAnswer === choice;
                  const isWrong = gameState === 'answered' && isSelected && !answerResult?.correct;
                  return (
                    <Button
                      key={choice}
                      fullWidth
                      disabled={gameState !== 'question'}
                      onClick={() => handleAnswer(choice)}
                      variant="outlined"
                      sx={{
                        justifyContent: 'flex-start', textAlign: 'left',
                        textTransform: 'none', fontSize: '0.85rem', fontWeight: 500,
                        py: 1.25, px: 1.5, borderRadius: `${radii.md}px`,
                        borderColor: isCorrect
                          ? theme.palette.success.main
                          : isWrong
                            ? theme.palette.error.main
                            : alpha(theme.palette.primary.main, 0.3),
                        bgcolor: isCorrect
                          ? alpha(theme.palette.success.main, 0.12)
                          : isWrong
                            ? alpha(theme.palette.error.main, 0.1)
                            : isSelected
                              ? alpha(theme.palette.primary.main, 0.08)
                              : '#fff',
                        color: isCorrect
                          ? theme.palette.success.dark
                          : isWrong
                            ? theme.palette.error.dark
                            : theme.palette.text.primary,
                        borderWidth: isCorrect || isWrong ? 2 : 1,
                        '&.Mui-disabled': {
                          color: isCorrect
                            ? theme.palette.success.dark
                            : isWrong
                              ? theme.palette.error.dark
                              : alpha(theme.palette.text.primary, 0.5),
                          borderColor: isCorrect
                            ? theme.palette.success.main
                            : isWrong
                              ? theme.palette.error.main
                              : alpha(theme.palette.divider, 0.3),
                        },
                      }}
                      startIcon={isCorrect ? <CheckCircleIcon /> : isWrong ? <CancelIcon /> : undefined}
                    >
                      {choice}
                    </Button>
                  );
                })}
              </Box>

              {gameState === 'answered' && answerResult && (
                <Box sx={{
                  mt: 1.5, py: 1, px: 1.25, borderRadius: 2,
                  textAlign: 'center',
                  bgcolor: answerResult.correct
                    ? alpha(theme.palette.success.main, 0.1)
                    : alpha(theme.palette.error.main, 0.08),
                  border: `1px solid ${alpha(
                    answerResult.correct ? theme.palette.success.main : theme.palette.error.main,
                    0.3,
                  )}`,
                }}>
                  <Typography sx={{
                    fontWeight: 800, fontSize: '0.9rem',
                    color: answerResult.correct ? theme.palette.success.dark : theme.palette.error.dark,
                  }}>
                    {answerResult.correct
                      ? `+${answerResult.pointsEarned} point${answerResult.pointsEarned === 1 ? '' : 's'}!`
                      : 'Not this time'}
                  </Typography>
                  {answerResult.correct && (answerResult.highScoreBonus || 0) > 0 && (
                    <Typography sx={{
                      fontWeight: 600, fontSize: '0.7rem',
                      color: colors.medal.gold, mt: 0.25,
                    }}>
                      + {answerResult.highScoreBonus} high score bonus!
                    </Typography>
                  )}
                  {lockResult?.isNewHighScore && (
                    <Typography sx={{
                      fontWeight: 700, fontSize: '0.7rem',
                      color: colors.medal.gold, mt: 0.25,
                    }}>
                      New high score!
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}

          {errorMsg && (
            <Typography sx={{ mt: 1, fontSize: '0.75rem', color: 'error.main', textAlign: 'center' }}>
              {errorMsg}
            </Typography>
          )}
        </Box>
      )}
    </Card>
  );
};

export default TetrisGame;
