// CrosswordGame — arcade-only crossword puzzle game mode.
//
// Mechanics:
//  1. Generate crossword via /crossword/generate endpoint
//  2. Fill in letters by tapping cells and typing
//  3. Check answers, reveal clues for penalty, submit when done

import AppsIcon from '@mui/icons-material/Apps';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Box, Button, Card, Collapse, IconButton, Typography,
  alpha, keyframes, useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { submitArcadeScore } from '../../api/modules/arcade';
import { apiService } from '../../services/ApiService';
import { colors } from '../../shared/design-system/tokens/colors';
import { motion } from '../../shared/design-system/tokens/motion';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('CrosswordGame');

// ── Constants ──────────────────────────────────────────────────────

const CELL_SIZE = 28;
const REVEAL_PENALTY = 2;

// ── Animations ─────────────────────────────────────────────────────

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
`;

const resultPop = keyframes`
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { opacity: 1; transform: scale(1.1); }
  100% { opacity: 1; transform: scale(1); }
`;

// ── Types ─────────────────────────────────────────────────────────

interface Clue {
  number: number;
  clue: string;
  answer: string;
  row: number;
  col: number;
  direction: 'across' | 'down';
}

interface CrosswordData {
  size: number;
  grid: string[][];
  clues: Clue[];
}

interface CellState {
  letter: string;
  isBlack: boolean;
  clueNumber: number | null;
  /** Which clues this cell belongs to */
  clueIds: number[];
  checked?: 'correct' | 'wrong';
  revealed?: boolean;
}

type GameState = 'loading' | 'playing' | 'complete';

interface CrosswordGameProps {
  userId: string;
  mode?: 'arcade';
  onClose: () => void;
  onComplete?: (result: { correct: boolean; streak: number; pointsEarned: number }) => void;
}

// ── Loading messages ───────────────────────────────────────────────

const LOADING_MESSAGES = [
  'Crafting your crossword...',
  'Placing words on the grid...',
  'Checking intersections...',
  'Almost there...',
];

// ── Component ──────────────────────────────────────────────────────

const CrosswordGame: React.FC<CrosswordGameProps> = ({
  userId,
  onClose,
  onComplete,
}) => {
  const theme = useTheme();

  // State
  const [gameState, setGameState] = useState<GameState>('loading');
  const [crosswordData, setCrosswordData] = useState<CrosswordData | null>(null);
  const [cells, setCells] = useState<CellState[][]>([]);
  const [userInput, setUserInput] = useState<string[][]>([]);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [activeDirection, setActiveDirection] = useState<'across' | 'down'>('across');
  const [activeClueIndex, setActiveClueIndex] = useState<number>(0);
  const [revealedClues, setRevealedClues] = useState<Set<number>>(new Set());
  const [checkedCells, setCheckedCells] = useState<Map<string, 'correct' | 'wrong'>>(new Map());
  const [finalScore, setFinalScore] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [difficultyMultiplier, setDifficultyMultiplier] = useState(1);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const [acrossOpen, setAcrossOpen] = useState(true);
  const [downOpen, setDownOpen] = useState(true);

  // Refs
  const rootRef = useRef<HTMLDivElement>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Timer — counts up while playing
  useEffect(() => {
    if (gameState === 'playing') {
      timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState]);

  // ── Derived data ──────────────────────────────────────────────

  const acrossClues = useMemo(
    () => (crosswordData?.clues ?? []).filter(c => c.direction === 'across').sort((a, b) => a.number - b.number),
    [crosswordData],
  );

  const downClues = useMemo(
    () => (crosswordData?.clues ?? []).filter(c => c.direction === 'down').sort((a, b) => a.number - b.number),
    [crosswordData],
  );

  const allCluesSorted = useMemo(
    () => [...acrossClues, ...downClues],
    [acrossClues, downClues],
  );

  const activeClue = useMemo(() => {
    if (!crosswordData || !activeCell) return null;
    // Find clue matching active direction that covers the active cell
    return crosswordData.clues.find(c => {
      if (c.direction !== activeDirection) return false;
      if (c.direction === 'across') {
        return c.row === activeCell.row && activeCell.col >= c.col && activeCell.col < c.col + c.answer.length;
      }
      return c.col === activeCell.col && activeCell.row >= c.row && activeCell.row < c.row + c.answer.length;
    }) ?? null;
  }, [crosswordData, activeCell, activeDirection]);

  /** Total fillable cells */
  const totalCells = useMemo(() => {
    if (!cells.length) return 0;
    let count = 0;
    for (const row of cells) {
      for (const cell of row) {
        if (!cell.isBlack) count++;
      }
    }
    return count;
  }, [cells]);

  /** Cells in the active word */
  const activeWordCells = useMemo(() => {
    if (!activeClue) return new Set<string>();
    const set = new Set<string>();
    for (let i = 0; i < activeClue.answer.length; i++) {
      const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
      const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
      set.add(`${r},${c}`);
    }
    return set;
  }, [activeClue]);

  /** Check if a clue is fully filled */
  const isClueComplete = useCallback((clue: Clue): boolean => {
    for (let i = 0; i < clue.answer.length; i++) {
      const r = clue.direction === 'across' ? clue.row : clue.row + i;
      const c = clue.direction === 'across' ? clue.col + i : clue.col;
      if (!userInput[r]?.[c]) return false;
    }
    return true;
  }, [userInput]);

  // ── Generate crossword ────────────────────────────────────────

  const generateCrossword = useCallback(async () => {
    setGameState('loading');
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 2500);

    try {
      const data = await apiService.request<CrosswordData>('/crossword/generate', {
        method: 'POST',
        body: JSON.stringify({ userId }),
      });

      clearInterval(msgInterval);

      // Validate response
      if (!data?.grid || !data?.clues || !data?.size || !Array.isArray(data.grid)) {
        logger.error('Invalid crossword data', { data });
        setLoadingMsg('Invalid puzzle data. Tap to retry.');
        return;
      }

      // Ensure grid dimensions match size
      const size = data.size;
      if (data.grid.length < size) {
        logger.error('Grid rows mismatch', { gridRows: data.grid.length, size });
        setLoadingMsg('Puzzle generation error. Tap to retry.');
        return;
      }

      setCrosswordData(data);
      setDifficultyMultiplier((data as any).difficultyMultiplier || 1);
      setElapsedSeconds(0);
      const newCells: CellState[][] = [];
      const newInput: string[][] = [];

      // Build clue number map
      const clueNumMap = new Map<string, number>();
      const cellClueMap = new Map<string, number[]>();

      for (const clue of data.clues) {
        clueNumMap.set(`${clue.row},${clue.col}`, clue.number);
        for (let i = 0; i < clue.answer.length; i++) {
          const r = clue.direction === 'across' ? clue.row : clue.row + i;
          const c = clue.direction === 'across' ? clue.col + i : clue.col;
          const key = `${r},${c}`;
          const existing = cellClueMap.get(key) ?? [];
          existing.push(clue.number);
          cellClueMap.set(key, existing);
        }
      }

      for (let r = 0; r < size; r++) {
        const row: CellState[] = [];
        const inputRow: string[] = [];
        for (let c = 0; c < size; c++) {
          const cell = data.grid[r]?.[c] ?? '.';
          const isBlack = cell === '.';
          const key = `${r},${c}`;
          row.push({
            letter: isBlack ? '' : cell,
            isBlack,
            clueNumber: clueNumMap.get(key) ?? null,
            clueIds: cellClueMap.get(key) ?? [],
          });
          inputRow.push('');
        }
        newCells.push(row);
        newInput.push(inputRow);
      }

      setCells(newCells);
      setUserInput(newInput);
      setRevealedClues(new Set());
      setCheckedCells(new Map());
      setActiveCell(null);
      setActiveDirection('across');
      setActiveClueIndex(0);
      setGameState('playing');
      logger.info('Crossword generated', { size: data.size, clues: data.clues.length });
    } catch (err) {
      clearInterval(msgInterval);
      logger.error('Failed to generate crossword', err);
      setLoadingMsg('Failed to generate. Tap to retry.');
    }
  }, [userId]);

  // Trigger initial generation on mount
  const hasStarted = useRef<boolean | null>(null);
  if (hasStarted.current == null) {
    hasStarted.current = true;
    generateCrossword();
  }

  // ── Cell interaction ──────────────────────────────────────────

  const selectCell = useCallback((row: number, col: number) => {
    if (!cells[row]?.[col] || cells[row][col].isBlack) return;

    if (activeCell?.row === row && activeCell?.col === col) {
      // Toggle direction on same cell
      setActiveDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setActiveCell({ row, col });
    }

    // Focus input immediately (must be in same gesture for iOS keyboard)
    hiddenInputRef.current?.focus();

    // Scroll cell into view on mobile
    const cellEl = gridRef.current?.querySelector(`[data-cell="${row}-${col}"]`);
    if (cellEl) {
      (cellEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [cells, activeCell]);

  const advanceCell = useCallback((forward: boolean) => {
    if (!activeCell) return;
    const { row, col } = activeCell;
    const dr = activeDirection === 'down' ? (forward ? 1 : -1) : 0;
    const dc = activeDirection === 'across' ? (forward ? 1 : -1) : 0;
    const nr = row + dr;
    const nc = col + dc;
    if (cells[nr]?.[nc] && !cells[nr][nc].isBlack) {
      setActiveCell({ row: nr, col: nc });
    }
  }, [activeCell, activeDirection, cells]);

  const handleKeyInput = useCallback((key: string) => {
    if (!activeCell || gameState !== 'playing') return;
    const { row, col } = activeCell;

    if (key === 'Backspace') {
      setUserInput(prev => {
        const next = prev.map(r => [...r]);
        if (next[row][col]) {
          next[row][col] = '';
        } else {
          // Move back and clear that cell
          const dr = activeDirection === 'down' ? -1 : 0;
          const dc = activeDirection === 'across' ? -1 : 0;
          const pr = row + dr;
          const pc = col + dc;
          if (cells[pr]?.[pc] && !cells[pr][pc].isBlack) {
            next[pr][pc] = '';
            setActiveCell({ row: pr, col: pc });
          }
        }
        return next;
      });
      // Clear check state for this cell
      setCheckedCells(prev => {
        const next = new Map(prev);
        next.delete(`${row},${col}`);
        return next;
      });
      return;
    }

    const letter = key.toUpperCase();
    if (letter.length === 1 && letter >= 'A' && letter <= 'Z') {
      setUserInput(prev => {
        const next = prev.map(r => [...r]);
        next[row][col] = letter;
        return next;
      });
      // Clear check state for this cell
      setCheckedCells(prev => {
        const next = new Map(prev);
        next.delete(`${row},${col}`);
        return next;
      });
      advanceCell(true);
    }
  }, [activeCell, activeDirection, cells, gameState, advanceCell]);

  // ── Clue navigation ───────────────────────────────────────────

  // Derive active clue index from active clue (avoids setState in effect)
  const derivedClueIndex = useMemo(() => {
    if (!activeClue) return activeClueIndex;
    const idx = allCluesSorted.findIndex(
      c => c.number === activeClue.number && c.direction === activeClue.direction,
    );
    return idx >= 0 ? idx : activeClueIndex;
  }, [activeClue, allCluesSorted, activeClueIndex]);

  const jumpToClue = useCallback((clue: Clue) => {
    setActiveCell({ row: clue.row, col: clue.col });
    setActiveDirection(clue.direction);
    const idx = allCluesSorted.findIndex(c => c.number === clue.number && c.direction === clue.direction);
    if (idx >= 0) setActiveClueIndex(idx);
    hiddenInputRef.current?.focus();
  }, [allCluesSorted]);

  const navigateClue = useCallback((delta: number) => {
    const nextIdx = (derivedClueIndex + delta + allCluesSorted.length) % allCluesSorted.length;
    setActiveClueIndex(nextIdx);
    jumpToClue(allCluesSorted[nextIdx]);
  }, [derivedClueIndex, allCluesSorted, jumpToClue]);

  // No document-level keyboard listener needed — the hidden input
  // captures all keystrokes via its onKeyDown handler.

  // ── Check / Reveal / Submit ───────────────────────────────────

  const handleCheck = useCallback(() => {
    if (!crosswordData) return;
    const newChecked = new Map<string, 'correct' | 'wrong'>();
    for (let r = 0; r < crosswordData.size; r++) {
      for (let c = 0; c < crosswordData.size; c++) {
        if (cells[r][c].isBlack) continue;
        const input = userInput[r][c];
        if (!input) continue;
        const correct = input === crosswordData.grid[r][c];
        newChecked.set(`${r},${c}`, correct ? 'correct' : 'wrong');
      }
    }
    setCheckedCells(newChecked);
  }, [crosswordData, cells, userInput]);

  const handleRevealClue = useCallback(() => {
    if (!activeClue || !crosswordData) return;
    setRevealedClues(prev => new Set(prev).add(activeClue.number));
    setUserInput(prev => {
      const next = prev.map(r => [...r]);
      for (let i = 0; i < activeClue.answer.length; i++) {
        const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
        const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
        next[r][c] = crosswordData.grid[r][c];
      }
      return next;
    });
    // Mark revealed cells as correct
    setCheckedCells(prev => {
      const next = new Map(prev);
      for (let i = 0; i < activeClue.answer.length; i++) {
        const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
        const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
        next.set(`${r},${c}`, 'correct');
      }
      return next;
    });
  }, [activeClue, crosswordData]);

  const handleSubmit = useCallback(async () => {
    if (!crosswordData) return;

    let correctCount = 0;
    for (let r = 0; r < crosswordData.size; r++) {
      for (let c = 0; c < crosswordData.size; c++) {
        if (cells[r][c].isBlack) continue;
        if (userInput[r][c] === crosswordData.grid[r][c]) {
          correctCount++;
        }
      }
    }

    const penalty = revealedClues.size * REVEAL_PENALTY;
    const baseScore = Math.max(0, correctCount - penalty);

    // Time bonus: faster = more points. Under 60s = 2x, under 120s = 1.5x, under 180s = 1.2x
    const timeMultiplier = elapsedSeconds < 60 ? 2 : elapsedSeconds < 120 ? 1.5 : elapsedSeconds < 180 ? 1.2 : 1;

    // Difficulty multiplier from backend (1 = easy, 1.5 = medium, 2 = hard)
    const score = Math.round(baseScore * timeMultiplier * difficultyMultiplier);
    setFinalScore(score);
    setGameState('complete');

    try {
      await submitArcadeScore(userId, 'crossword', score);
      logger.info('Score submitted', { score, baseScore, timeMultiplier, difficultyMultiplier, elapsed: elapsedSeconds });
    } catch (err) {
      logger.error('Failed to submit score', err);
    }

    onComplete?.({ correct: correctCount === totalCells, streak: 0, pointsEarned: score });
  }, [crosswordData, cells, userInput, revealedClues, userId, totalCells, onComplete, elapsedSeconds, difficultyMultiplier]);

  // ── Render helpers ────────────────────────────────────────────

  const renderGrid = () => {
    if (!crosswordData) return null;
    const size = crosswordData.size;
    const gridWidth = size * CELL_SIZE;

    return (
      <Box
        ref={gridRef}
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${size}, ${CELL_SIZE}px)`,
          gridTemplateRows: `repeat(${size}, ${CELL_SIZE}px)`,
          gap: '1px',
          bgcolor: alpha('#000', 0.3),
          border: `1px solid ${alpha('#000', 0.3)}`,
          width: gridWidth + size + 1,
          mx: 'auto',
          my: 1,
        }}
      >
        {cells.map((row, r) =>
          row.map((cell, c) => {
            if (cell.isBlack) {
              return (
                <Box
                  key={`${r}-${c}`}
                  data-cell={`${r}-${c}`}
                  sx={{ bgcolor: '#2c2c2c', width: CELL_SIZE, height: CELL_SIZE }}
                />
              );
            }

            const isActive = activeCell?.row === r && activeCell?.col === c;
            const isInWord = activeWordCells.has(`${r},${c}`);
            const checkState = checkedCells.get(`${r},${c}`);
            const input = userInput[r]?.[c] ?? '';

            let bg = '#ffffff';
            if (checkState === 'correct') bg = alpha(colors.result.correct, 0.25);
            else if (checkState === 'wrong') bg = alpha(colors.result.incorrect, 0.25);
            else if (isActive) bg = alpha('#2196f3', 0.15);
            else if (isInWord) bg = alpha('#2196f3', 0.07);

            return (
              <Box
                key={`${r}-${c}`}
                data-cell={`${r}-${c}`}
                onClick={() => selectCell(r, c)}
                sx={{
                  position: 'relative',
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  bgcolor: bg,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: isActive ? '2px solid #1565c0' : '1px solid transparent',
                  boxSizing: 'border-box',
                  transition: `background ${motion.duration.fast} ${motion.ease.smooth}`,
                  animation: checkState === 'wrong' ? `${shake} 0.4s ease` : undefined,
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Clue number */}
                {cell.clueNumber != null && (
                  <Typography
                    sx={{
                      position: 'absolute',
                      top: 1,
                      left: 2,
                      fontSize: '0.5rem',
                      lineHeight: 1,
                      fontWeight: 600,
                      color: alpha('#000', 0.6),
                      pointerEvents: 'none',
                    }}
                  >
                    {cell.clueNumber}
                  </Typography>
                )}
                {/* Letter */}
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: checkState === 'correct' ? colors.result.correct
                      : checkState === 'wrong' ? colors.result.incorrect
                      : '#222',
                    pointerEvents: 'none',
                  }}
                >
                  {input}
                </Typography>
              </Box>
            );
          }),
        )}
      </Box>
    );
  };

  const renderClueBar = () => {
    if (!activeClue) return null;
    return (
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.5,
        px: 1.5, py: 1, bgcolor: alpha('#2196f3', 0.06),
        borderTop: `1px solid ${alpha('#2196f3', 0.15)}`,
        borderBottom: `1px solid ${alpha('#2196f3', 0.15)}`,
      }}>
        <IconButton size="small" onClick={() => navigateClue(-1)} sx={{ p: 0.25 }}>
          <ArrowBackIosNewIcon sx={{ fontSize: 14 }} />
        </IconButton>
        <Typography sx={{ flex: 1, fontSize: '0.8rem', lineHeight: 1.3 }}>
          <Box component="span" sx={{ fontWeight: 700, mr: 0.5 }}>
            {activeClue.number}{activeClue.direction === 'across' ? 'A' : 'D'}
          </Box>
          {activeClue.clue}
        </Typography>
        <IconButton size="small" onClick={() => navigateClue(1)} sx={{ p: 0.25 }}>
          <ArrowForwardIosIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>
    );
  };

  const renderClueList = (title: string, clues: Clue[], open: boolean, toggle: () => void) => (
    <Box sx={{ px: 1.5 }}>
      <Typography
        onClick={toggle}
        sx={{
          fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer',
          py: 0.75, color: theme.palette.text.secondary,
          display: 'flex', alignItems: 'center', gap: 0.5,
          userSelect: 'none',
        }}
      >
        {title}
        <Box component="span" sx={{
          fontSize: '0.65rem',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: `transform ${motion.duration.fast}`,
        }}>
          {'\u25B6'}
        </Box>
      </Typography>
      <Collapse in={open}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, pb: 1 }}>
          {clues.map(clue => {
            const complete = isClueComplete(clue);
            const isActive = activeClue?.number === clue.number && activeClue?.direction === clue.direction;
            return (
              <Box
                key={`${clue.direction}-${clue.number}`}
                onClick={() => jumpToClue(clue)}
                sx={{
                  display: 'flex', alignItems: 'flex-start', gap: 0.75,
                  py: 0.5, px: 0.75, cursor: 'pointer',
                  borderRadius: `${radii.sm}px`,
                  bgcolor: isActive ? alpha('#2196f3', 0.08) : 'transparent',
                  '&:hover': { bgcolor: alpha('#2196f3', 0.05) },
                  transition: `background ${motion.duration.fast}`,
                }}
              >
                <Typography sx={{
                  fontWeight: 700, fontSize: '0.75rem', minWidth: 20,
                  color: complete ? colors.result.correct : theme.palette.text.primary,
                }}>
                  {clue.number}.
                </Typography>
                <Typography sx={{
                  fontSize: '0.75rem', lineHeight: 1.4, flex: 1,
                  color: complete ? theme.palette.text.secondary : theme.palette.text.primary,
                  textDecoration: complete ? 'line-through' : 'none',
                }}>
                  {clue.clue}
                </Typography>
                {complete && (
                  <CheckIcon sx={{ fontSize: 14, color: colors.result.correct, mt: 0.25 }} />
                )}
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );

  // ── Filled count for score display ─────────────────────────────

  const filledCorrect = useMemo(() => {
    if (!crosswordData) return 0;
    let count = 0;
    for (let r = 0; r < crosswordData.size; r++) {
      for (let c = 0; c < crosswordData.size; c++) {
        if (cells[r]?.[c]?.isBlack) continue;
        if (userInput[r]?.[c] === crosswordData.grid[r][c]) count++;
      }
    }
    return count;
  }, [crosswordData, cells, userInput]);

  // ── Render ────────────────────────────────────────────────────

  return (
    <Card ref={rootRef} sx={{
      overflow: 'hidden', borderRadius: 3, maxWidth: 400, mx: 'auto',
      border: `2px solid ${alpha('#009688', 0.5)}`,
      boxShadow: `0 0 20px ${alpha('#009688', 0.15)}`,
      animation: `${fadeIn} ${motion.duration.slow} ${motion.ease.bounce}`,
    }}>
      {/* Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #00695c 0%, #004d40 100%)',
        color: 'white', px: 2, py: 1.25,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <AppsIcon sx={{ fontSize: 20 }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, letterSpacing: 1 }}>
          FAMILY CROSSWORD
        </Typography>
        {gameState === 'playing' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
            <Typography sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
              {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
              {filledCorrect}/{totalCells}
            </Typography>
          </Box>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: 'white', p: 0.5 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Loading */}
      {gameState === 'loading' && (
        <Box sx={{
          py: 6, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 2,
        }}>
          <LoadingDots size={10} color="#009688" />
          <Typography
            onClick={loadingMsg.includes('retry') ? generateCrossword : undefined}
            sx={{
              fontSize: '0.85rem', color: theme.palette.text.secondary,
              cursor: loadingMsg.includes('retry') ? 'pointer' : 'default',
              textDecoration: loadingMsg.includes('retry') ? 'underline' : 'none',
            }}
          >
            {loadingMsg}
          </Typography>
        </Box>
      )}

      {/* Playing */}
      {gameState === 'playing' && crosswordData && (
        <Box sx={{ bgcolor: colors.surface.subtle }}>
          {/* Input for keyboard capture — positioned over active cell */}
          <input
            ref={hiddenInputRef}
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            style={{
              position: 'absolute',
              top: activeCell ? activeCell.row * 28 + 10 : 0,
              left: activeCell ? activeCell.col * 28 + 10 : 0,
              width: 28,
              height: 28,
              opacity: 0.01,
              zIndex: 5,
              caretColor: 'transparent',
              fontSize: 16,
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
            onKeyDown={e => {
              if (e.key === 'Backspace' || e.key === 'Tab' || /^[a-zA-Z]$/.test(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                handleKeyInput(e.key);
              }
              // Always clear input value to prevent accumulation
              requestAnimationFrame(() => {
                if (hiddenInputRef.current) hiddenInputRef.current.value = '';
              });
            }}
          />

          {/* Grid */}
          <Box sx={{ overflow: 'auto', py: 1 }}>
            {renderGrid()}
          </Box>

          {/* Active clue bar */}
          {renderClueBar()}

          {/* Clue lists */}
          <Box sx={{ maxHeight: 200, overflow: 'auto', py: 0.5 }}>
            {renderClueList('Across', acrossClues, acrossOpen, () => setAcrossOpen(p => !p))}
            {renderClueList('Down', downClues, downOpen, () => setDownOpen(p => !p))}
          </Box>

          {/* Controls */}
          <Box sx={{
            display: 'flex', gap: 1, px: 1.5, py: 1.5,
            borderTop: `1px solid ${alpha('#000', 0.08)}`,
            bgcolor: '#fff',
          }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CheckIcon sx={{ fontSize: 16 }} />}
              onClick={handleCheck}
              sx={{
                flex: 1, fontSize: '0.75rem', textTransform: 'none',
                borderRadius: `${radii.md}px`,
              }}
            >
              Check
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="warning"
              startIcon={<VisibilityIcon sx={{ fontSize: 16 }} />}
              onClick={handleRevealClue}
              disabled={!activeClue}
              sx={{
                flex: 1, fontSize: '0.75rem', textTransform: 'none',
                borderRadius: `${radii.md}px`,
              }}
            >
              Reveal ({-REVEAL_PENALTY}pts)
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleSubmit}
              sx={{
                flex: 1, fontSize: '0.75rem', textTransform: 'none',
                borderRadius: `${radii.md}px`,
                bgcolor: '#00695c',
                '&:hover': { bgcolor: '#004d40' },
              }}
            >
              Submit
            </Button>
          </Box>
        </Box>
      )}

      {/* Complete */}
      {gameState === 'complete' && (
        <Box sx={{
          py: 4, px: 3,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 2,
          animation: `${resultPop} 0.5s ${motion.ease.bounce}`,
        }}>
          <Typography sx={{ fontSize: '1.4rem', fontWeight: 800 }}>
            {finalScore === totalCells ? 'Perfect!' : 'Puzzle Complete!'}
          </Typography>
          <Box sx={{
            display: 'flex', alignItems: 'baseline', gap: 1,
          }}>
            <Typography sx={{ fontSize: '2.5rem', fontWeight: 800, color: '#00695c' }}>
              {finalScore}
            </Typography>
            <Typography sx={{ fontSize: '1rem', color: theme.palette.text.secondary }}>
              / {totalCells} pts
            </Typography>
          </Box>
          {/* Scoring breakdown */}
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
              Time: {Math.floor(elapsedSeconds / 60)}:{(elapsedSeconds % 60).toString().padStart(2, '0')}
              {elapsedSeconds < 60 ? ' (2× speed bonus!)' : elapsedSeconds < 120 ? ' (1.5× speed bonus)' : elapsedSeconds < 180 ? ' (1.2× speed bonus)' : ''}
            </Typography>
            {difficultyMultiplier > 1 && (
              <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
                Difficulty: {difficultyMultiplier}× multiplier
              </Typography>
            )}
            {revealedClues.size > 0 && (
              <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
                {revealedClues.size} clue{revealedClues.size !== 1 ? 's' : ''} revealed ({-revealedClues.size * REVEAL_PENALTY} pts)
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
            <Button
              variant="outlined"
              onClick={generateCrossword}
              sx={{
                textTransform: 'none',
                borderRadius: `${radii.md}px`,
                borderColor: '#00695c',
                color: '#00695c',
              }}
            >
              Play Again
            </Button>
            <Button
              variant="contained"
              onClick={onClose}
              sx={{
                textTransform: 'none',
                borderRadius: `${radii.md}px`,
                bgcolor: '#00695c',
                '&:hover': { bgcolor: '#004d40' },
              }}
            >
              Back to Arcade
            </Button>
          </Box>
        </Box>
      )}
    </Card>
  );
};

export default CrosswordGame;
