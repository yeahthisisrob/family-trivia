// Curling — weekly mobile game mode.
//
// Mechanics:
//  1. Touch the stone and drag upward to aim and set power
//  2. Release to send the stone sliding up the sheet
//  3. Tap anywhere during the slide to "sweep" — reduces friction briefly
//  4. Stone stops in a scoring ring → locks a multiplier (3×/2×/1×/0.5×)
//  5. A trivia question is generated; answer correctly to earn multiplier points

import AcUnitIcon from '@mui/icons-material/AcUnit';
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box, Button, Card, Chip, IconButton, Typography,
  alpha, keyframes, useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { submitArcadeScore } from '../../api/modules/arcade';
import { lockCurling, submitCurlingAnswer } from '../../api/modules/games';
import { colors } from '../../shared/design-system/tokens/colors';
import { motion } from '../../shared/design-system/tokens/motion';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import { getCurlingAIMove } from '../../api/modules/gameAI';
import { CurlingSimulation, STOP_THRESHOLD, OFF_SHEET_MARGIN } from './curlingPhysics';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('CurlingGame');

// ── Constants ──────────────────────────────────────────────────────

const SHEET_HEIGHT = 460;      // px
const SHEET_WIDTH = 280;       // px
const HOUSE_CENTER_Y = 120;    // px from top — moved down to fit larger house
const STONE_SIZE = 20;         // player stone diameter (proportional to house)
const OPPONENT_STONE_SIZE = 20;
const STONE_START_Y = SHEET_HEIGHT - 50; // near bottom

// Rings (radius in px from house center)
// Real curling: button(1ft) : 4-foot : 8-foot : 12-foot = 1:4:8:12
// 12-foot house = 80% of sheet width → diameter 224px → radius 112px.
// Slightly scaled down for mobile playability.
const TWELVE_FOOT_R = 100;     // outer house (12-foot ring)
const EIGHT_FOOT_R = 67;       // 8-foot ring
const FOUR_FOOT_R = 33;        // 4-foot ring
const BULLSEYE_R = 8;          // button (1-foot ring)
// Legacy aliases used by scoring
const INNER_R = FOUR_FOOT_R;
const OUTER_R = TWELVE_FOOT_R;

// Physics — tuned so a good shot (≈65% power) lands on the button in ~2.5s
const MAX_POWER = 100;
const POWER_TO_VELOCITY = 1.5; // velocity units per % power
const BASE_FRICTION = 0.988;   // per frame decay (higher = longer slide)
const SWEPT_FRICTION = 0.995;  // sweeping reduces friction briefly
const SWEEP_DURATION_MS = 600;
const MIN_STOP_VELOCITY = 0.15;

// Drag interaction
const DRAG_HIT_RADIUS = 35;    // px — how close to stone to start drag
const MAX_DRAG_DISTANCE = 200;  // px — cap on drag distance for max power

// ── Animations ─────────────────────────────────────────────────────

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const iceShine = keyframes`
  0%, 100% { opacity: 0.15; transform: translateX(-100%); }
  50%      { opacity: 0.3; transform: translateX(200%); }
`;

const resultPop = keyframes`
  0%   { opacity: 0; transform: scale(0.7); }
  60%  { opacity: 1; transform: scale(1.15); }
  100% { opacity: 1; transform: scale(1); }
`;

const sweepPulse = keyframes`
  0%   { transform: scale(1); }
  50%  { transform: scale(1.35); }
  100% { transform: scale(1); }
`;

const knockoutPop = keyframes`
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2); }
`;

const bullseyeCelebrate = keyframes`
  0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  60%  { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.1); }
`;

// ── Types ─────────────────────────────────────────────────────────

interface OpponentStone {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SweepMark {
  x: number;
  y: number;
  /** 0-1, fades toward 0 over SWEEP_DURATION_MS */
  opacity: number;
}

// ── Helpers ────────────────────────────────────────────────────────

// Number of opponent stones in the house — always the same for fairness.
const OPPONENT_COUNT = 3;

/** Which ring zone a stone is in (for scoring displacement). */
function stoneRing(x: number, y: number): 'button' | '4ft' | '8ft' | '12ft' | 'out' {
  const dx = x - SHEET_WIDTH / 2;
  const dy = y - HOUSE_CENTER_Y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= BULLSEYE_R) return 'button';
  if (dist <= FOUR_FOOT_R) return '4ft';
  if (dist <= EIGHT_FOOT_R) return '8ft';
  if (dist <= TWELVE_FOOT_R) return '12ft';
  return 'out';
}

// Points for knocking an opponent out of each ring → out of house.
// Deeper stones are worth more — rewarding precision takeouts.
const RING_KNOCKOUT_POINTS: Record<string, number> = {
  button: 25,
  '4ft': 20,
  '8ft': 15,
  '12ft': 10,
};

// Points for pushing a stone from one ring to a worse one (partial displacement).
const DISPLACEMENT_POINTS: Record<string, number> = {
  button: 4,
  '4ft': 3,
  '8ft': 2,
  '12ft': 1,
  out: 0,
};

/** Compute score from stone placement + opponent displacement. */
function computeResult(
  stoneX: number,
  stoneY: number,
  opponentStones: OpponentStone[],
  startRings: string[],
): { multiplier: number; zone: string; precisionScore: number; knockouts: number } {
  const dx = stoneX - SHEET_WIDTH / 2;
  const dy = stoneY - HOUSE_CENTER_Y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const baseScore = Math.max(0, Math.round(100 - distance));

  // Score opponent displacement: points for each stone moved to a worse ring.
  let knockouts = 0;
  let displacementBonus = 0;
  for (let i = 0; i < opponentStones.length; i++) {
    const os = opponentStones[i];
    const startRing = startRings[i] || 'out';
    const endRing = stoneRing(os.x, os.y);

    if (endRing === 'out' && startRing !== 'out') {
      // Full knockout — stone was in the house, now it's out.
      knockouts++;
      displacementBonus += RING_KNOCKOUT_POINTS[startRing] || 10;
    } else if (startRing !== 'out' && endRing !== startRing) {
      // Partial displacement — pushed to a worse ring.
      const startVal = DISPLACEMENT_POINTS[startRing] || 0;
      const endVal = DISPLACEMENT_POINTS[endRing] || 0;
      if (endVal < startVal) {
        displacementBonus += (startVal - endVal) * 3;
      }
    }
  }

  const precisionScore = baseScore + displacementBonus;

  if (distance <= BULLSEYE_R) return { multiplier: 3, zone: 'Button', precisionScore, knockouts };
  if (distance <= FOUR_FOOT_R) return { multiplier: 2, zone: '4-foot', precisionScore, knockouts };
  if (distance <= EIGHT_FOOT_R) return { multiplier: 1.5, zone: '8-foot', precisionScore, knockouts };
  if (distance <= TWELVE_FOOT_R) return { multiplier: 1, zone: '12-foot', precisionScore, knockouts };
  return { multiplier: 0.5, zone: 'Outside', precisionScore, knockouts };
}

function generateOpponentStones(): OpponentStone[] {
  const stones: OpponentStone[] = [];
  // Spread stones across different rings for strategic variety.
  // 1 near button/4-foot, 1 in 8-foot, 1 in 12-foot.
  const placements = [
    { minR: 0, maxR: FOUR_FOOT_R * 0.8 },
    { minR: FOUR_FOOT_R * 0.5, maxR: EIGHT_FOOT_R * 0.85 },
    { minR: EIGHT_FOOT_R * 0.5, maxR: TWELVE_FOOT_R * 0.9 },
  ];
  for (let i = 0; i < OPPONENT_COUNT; i++) {
    const p = placements[i];
    const angle = Math.random() * Math.PI * 2;
    const dist = p.minR + Math.random() * (p.maxR - p.minR);
    stones.push({
      x: SHEET_WIDTH / 2 + Math.cos(angle) * dist,
      y: HOUSE_CENTER_Y + Math.sin(angle) * dist,
      vx: 0,
      vy: 0,
    });
  }
  return stones;
}

// ── Component ──────────────────────────────────────────────────────

type GameState = 'idle' | 'charging' | 'sliding' | 'result' | 'locking' | 'question' | 'submitting' | 'answered'
  | 'computerTurn' | 'endScore' | 'gameOver';

// ── Arcade multi-round types ─────────────────────────────────────

const TOTAL_ENDS = 3;
const THROWS_PER_END = 4; // 2 player + 2 computer, alternating

interface SheetStone {
  x: number; y: number;
  owner: 'player' | 'computer';
}

/** Score an end: team with closest stone to button scores 1 per stone
    closer than the opponent's closest. Real curling rules. */
function scoreEnd(stones: SheetStone[]): { playerPts: number; computerPts: number } {
  const dist = (s: SheetStone) => Math.sqrt((s.x - SHEET_WIDTH / 2) ** 2 + (s.y - HOUSE_CENTER_Y) ** 2);
  const inHouse = stones.filter(s => dist(s) <= TWELVE_FOOT_R);
  if (inHouse.length === 0) return { playerPts: 0, computerPts: 0 };

  const sorted = [...inHouse].sort((a, b) => dist(a) - dist(b));
  const closestTeam = sorted[0].owner;
  const oppClosest = sorted.find(s => s.owner !== closestTeam);
  const oppDist = oppClosest ? dist(oppClosest) : Infinity;

  let pts = 0;
  for (const s of sorted) {
    if (s.owner === closestTeam && dist(s) < oppDist) pts++;
    else break;
  }

  return closestTeam === 'player'
    ? { playerPts: pts, computerPts: 0 }
    : { playerPts: 0, computerPts: pts };
}

interface CurlingQuestion {
  question: string;
  choices: string[];
  category: string;
}

interface AnswerResult {
  correct: boolean;
  correctAnswer: string;
  pointsEarned: number;
  multiplier: number;
}

interface CurlingGameProps {
  userId: string;
  /** 'trivia' = weekly with question, 'arcade' = unlimited, just scores */
  mode?: 'trivia' | 'arcade';
  isCatchingUp?: boolean;
  onComplete?: (pointsEarned: number) => void;
  onClose: () => void;
}

const CurlingGame: React.FC<CurlingGameProps> = ({ userId, mode = 'trivia', isCatchingUp = false, onComplete, onClose }) => {
  const theme = useTheme();
  const isArcade = mode === 'arcade';

  const [state, setState] = useState<GameState>('idle');
  const [stoneY, setStoneY] = useState(STONE_START_Y);
  const [stoneX, setStoneX] = useState(SHEET_WIDTH / 2);
  const [sweepCount, setSweepCount] = useState(0);
  const [result, setResult] = useState<{ multiplier: number; zone: string; precisionScore: number; knockouts: number } | null>(null);
  const [question, setQuestion] = useState<CurlingQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [opponentStones, setOpponentStones] = useState<OpponentStone[]>(() =>
    isArcade ? [] : generateOpponentStones(),
  );
  // Track the starting ring of each opponent for displacement scoring (trivia mode).
  const startRingsRef = useRef<string[]>([]);
  const [sweepMarks, setSweepMarks] = useState<SweepMark[]>([]);
  const [knockoutTexts, setKnockoutTexts] = useState<{ id: number; x: number; y: number; pts: number }[]>([]);

  // ── Arcade multi-round state ───────────────────────────────────
  const [currentEnd, setCurrentEnd] = useState(1);
  const [playerTotal, setPlayerTotal] = useState(0);
  const [computerTotal, setComputerTotal] = useState(0);
  const [throwNum, setThrowNum] = useState(0); // 0-3 within the current end
  const throwNumRef = useRef(0);
  const [currentThrower, setCurrentThrower] = useState<'player' | 'computer'>('player');
  const currentThrowerRef = useRef<'player' | 'computer'>('player');
  const [sheetStones, setSheetStones] = useState<SheetStone[]>([]);
  const sheetStonesRef = useRef<SheetStone[]>([]);
  const [endResult, setEndResult] = useState<{ playerPts: number; computerPts: number } | null>(null);
  // Accumulated precision score for the arcade leaderboard (half-scale per throw).
  const [arcadeScore, setArcadeScore] = useState(0);
  const arcadeScoreRef = useRef(0);
  const [lastThrowScore, setLastThrowScore] = useState(0);

  // Drag state for slingshot interaction
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Refs for animation loop
  const velocityRef = useRef(0);
  const velocityXRef = useRef(0);
  const stoneYRef = useRef(STONE_START_Y);
  const stoneXRef = useRef(SHEET_WIDTH / 2);
  const sweptUntilRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const opponentStonesRef = useRef<OpponentStone[]>(opponentStones);
  if (startRingsRef.current.length === 0 && opponentStones.length > 0) {
    startRingsRef.current = opponentStones.map(os => stoneRing(os.x, os.y));
  }
  const knockoutIdRef = useRef(0);

  // Root container ref — for scrolling the game into view on mount
  const rootRef = useRef<HTMLDivElement | null>(null);


  // Lock page scroll while actively playing — prevents the page
  // moving around under the user during the whole session.
  useEffect(() => {
    if (state === 'idle') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [state]);

  // Fade out sweep marks over time
  useEffect(() => {
    if (sweepMarks.length === 0) return;
    const interval = 50; // ms between fade ticks
    const decrement = interval / SWEEP_DURATION_MS; // opacity drop per tick
    const timer = window.setInterval(() => {
      setSweepMarks(prev => {
        const next = prev
          .map(m => ({ ...m, opacity: m.opacity - decrement }))
          .filter(m => m.opacity > 0);
        return next;
      });
    }, interval);
    return () => window.clearInterval(timer);
  }, [sweepMarks.length]);

  // Clean up knockout texts after animation
  useEffect(() => {
    if (knockoutTexts.length === 0) return;
    const timer = window.setTimeout(() => {
      setKnockoutTexts([]);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [knockoutTexts.length]);

  // Auto-advance from result → depends on mode:
  // Trivia: lock → question. Arcade: submit score → done.
  useEffect(() => {
    if (state !== 'result' || !result) return;
    const id = window.setTimeout(async () => {
      if (mode === 'arcade') {
        // Arcade: submit precision score, then stay on result with "Play Again"
        setState('answered'); // reuse answered state for arcade done
        try {
          await submitArcadeScore(userId, 'curling', result.precisionScore);
        } catch (err) {
          logger.error('Arcade score submit failed', err);
        }
        return;
      }
      // Trivia: lock throw + generate question
      setState('locking');
      try {
        const lockResult = await lockCurling(userId, result.multiplier, isCatchingUp, result.precisionScore);
        setQuestion(lockResult.question);
        setState('question');
      } catch (err) {
        logger.error('Curling lock failed', err);
        setErrorMsg(err instanceof Error ? err.message : 'Failed to lock throw');
        window.setTimeout(() => onClose(), 2000);
      }
    }, 1400);
    return () => window.clearTimeout(id);
  }, [state, result, userId, mode, isCatchingUp, onClose]);

  // Submit answer → show result → onComplete
  const handleAnswer = useCallback(async (answer: string) => {
    if (state !== 'question' || selectedAnswer) return;
    setSelectedAnswer(answer);
    setState('submitting');
    try {
      const res = await submitCurlingAnswer(userId, answer);
      setAnswerResult(res);
      setState('answered');
      window.setTimeout(() => onComplete?.(res.pointsEarned), 2200);
    } catch (err) {
      logger.error('Curling answer submit failed', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit answer');
      window.setTimeout(() => onClose(), 2000);
    }
  }, [state, selectedAnswer, userId, onComplete, onClose]);

  // ── Slide physics loop ──────────────────────────────────────────

  // Regenerate opponent stones (called on "Play Again")
  const initOpponents = useCallback(() => {
    const newOpponents = generateOpponentStones();
    opponentStonesRef.current = newOpponents;
    startRingsRef.current = newOpponents.map(os => stoneRing(os.x, os.y));
    setOpponentStones(newOpponents);
  }, []);

  const simRef = useRef<CurlingSimulation | null>(null);

  const startSlide = useCallback((launchPower: number, angle: number) => {
    const speed = (launchPower / MAX_POWER) * POWER_TO_VELOCITY * 3;
    const vy = -(speed * Math.cos(angle));  // negative = up the sheet
    const vx = speed * Math.sin(angle);

    // Create a fresh matter.js simulation with current opponent positions
    simRef.current?.destroy();
    const sim = new CurlingSimulation(
      opponentStonesRef.current.map(os => ({ x: os.x, y: os.y })),
    );
    simRef.current = sim;
    sim.launch(vx, vy);

    stoneYRef.current = STONE_START_Y;
    stoneXRef.current = SHEET_WIDTH / 2;
    sweptUntilRef.current = 0;
    setSweepCount(0);
    setSweepMarks([]);
    setKnockoutTexts([]);
    setState('sliding');

    const step = () => {
      // Toggle sweeping based on the sweep timer
      const now = globalThis.performance.now();
      sim.setSweeping(now < sweptUntilRef.current);

      // Step the matter.js engine one frame
      sim.step();
      const snap = sim.snapshot();

      // Sync positions to React state + refs
      stoneXRef.current = snap.player.x;
      stoneYRef.current = snap.player.y;
      velocityRef.current = -snap.player.vy; // inverted for legacy compat
      velocityXRef.current = snap.player.vx;

      // Sync opponent positions
      for (let i = 0; i < snap.opponents.length && i < opponentStonesRef.current.length; i++) {
        opponentStonesRef.current[i].x = snap.opponents[i].x;
        opponentStonesRef.current[i].y = snap.opponents[i].y;
        opponentStonesRef.current[i].vx = snap.opponents[i].vx;
        opponentStonesRef.current[i].vy = snap.opponents[i].vy;
      }

      setStoneY(stoneYRef.current);
      setStoneX(stoneXRef.current);
      setOpponentStones([...opponentStonesRef.current]);

      if (snap.allStopped) {
        if (isArcade) {
          // ── Arcade multi-round: add thrown stone to sheet, advance turn ──
          const thrownStone: SheetStone = {
            x: stoneXRef.current, y: stoneYRef.current,
            owner: currentThrowerRef.current,
          };
          // Update sheet stones (player's stone + moved opponents)
          const updatedSheet: SheetStone[] = [];
          // Re-read opponent positions (they may have moved from collisions)
          for (let i = 0; i < opponentStonesRef.current.length; i++) {
            const os = opponentStonesRef.current[i];
            const prev = sheetStonesRef.current[i];
            if (prev) updatedSheet.push({ ...prev, x: os.x, y: os.y });
          }
          // Add the just-thrown stone (if it's still on the sheet)
          if (!snap.playerOffSheet) updatedSheet.push(thrownStone);
          // Filter out stones that went off-sheet
          const onSheet = updatedSheet.filter(s =>
            s.y > -OFF_SHEET_MARGIN && s.y < SHEET_HEIGHT + OFF_SHEET_MARGIN &&
            s.x > -OFF_SHEET_MARGIN && s.x < SHEET_WIDTH + OFF_SHEET_MARGIN,
          );
          sheetStonesRef.current = onSheet;
          setSheetStones(onSheet);

          const nextThrow = throwNumRef.current + 1;
          if (nextThrow >= THROWS_PER_END) {
            // End complete — score curling points AND precision.
            // Precision is scored NOW (end of end) so computer knockouts
            // reduce your score. Each surviving player stone in the house
            // scores based on distance from button, half scale.
            const er = scoreEnd(onSheet);
            setEndResult(er);
            setPlayerTotal(p => p + er.playerPts);
            setComputerTotal(c => c + er.computerPts);

            let endPrecision = 0;
            for (const s of onSheet) {
              if (s.owner !== 'player') continue;
              const dx = s.x - SHEET_WIDTH / 2;
              const dy = s.y - HOUSE_CENTER_Y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist <= TWELVE_FOOT_R) {
                endPrecision += Math.max(0, Math.round((100 - dist) / 2));
              }
            }
            setLastThrowScore(endPrecision);
            arcadeScoreRef.current += endPrecision;
            setArcadeScore(arcadeScoreRef.current);
            setState('endScore');
          } else {
            // Next throw
            throwNumRef.current = nextThrow;
            setThrowNum(nextThrow);
            const nextThrower = nextThrow % 2 === 0 ? 'player' : 'computer';
            currentThrowerRef.current = nextThrower;
            setCurrentThrower(nextThrower);
            // Reset stone to start position
            stoneYRef.current = STONE_START_Y;
            stoneXRef.current = SHEET_WIDTH / 2;
            setStoneY(STONE_START_Y);
            setStoneX(SHEET_WIDTH / 2);
            // Set up opponents = all current sheet stones
            opponentStonesRef.current = onSheet.map(s => ({ x: s.x, y: s.y, vx: 0, vy: 0 }));
            setOpponentStones([...opponentStonesRef.current]);

            if (nextThrower === 'computer') {
              setState('computerTurn');
            } else {
              setState('idle');
            }
          }
          return;
        }

        // ── Trivia mode: single-throw scoring ──
        const knockedOut: { id: number; x: number; y: number; pts: number }[] = [];
        for (let i = 0; i < opponentStonesRef.current.length; i++) {
          const os = opponentStonesRef.current[i];
          const sr = startRingsRef.current[i] || 'out';
          const er = stoneRing(os.x, os.y);
          if (er === 'out' && sr !== 'out') {
            knockoutIdRef.current += 1;
            const pts = RING_KNOCKOUT_POINTS[sr] || 10;
            const popX = Math.max(20, Math.min(SHEET_WIDTH - 20, os.x));
            const popY = Math.max(30, Math.min(SHEET_HEIGHT - 30, os.y));
            knockedOut.push({ id: knockoutIdRef.current, x: popX, y: popY, pts });
          }
        }
        if (knockedOut.length > 0) {
          setKnockoutTexts(knockedOut);
        }

        const finalResult = computeResult(stoneXRef.current, stoneYRef.current, opponentStonesRef.current, startRingsRef.current);
        setResult(finalResult);
        setState('result');
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    simRef.current?.destroy();
  }, []);

  // ── Computer throw (arcade) ─────────────────────────────────────

  useEffect(() => {
    if (state !== 'computerTurn' || !isArcade) return;
    let cancelled = false;

    // Try AI first, fall back to random logic.
    const doThrow = async () => {
      const aiMove = await getCurlingAIMove({
        stones: sheetStonesRef.current,
        throwNum: throwNumRef.current,
      });

      if (cancelled) return;

      let power: number;
      let angle: number;

      if (aiMove) {
        // AI returned a move — use it directly
        power = aiMove.power;
        angle = aiMove.angle;
        logger.info('Computer using AI move', { strategy: aiMove.strategy, power, angle });
      } else {
        // Fallback: random strategy
        const playerBest = sheetStonesRef.current
          .filter(s => s.owner === 'player')
          .map(s => Math.sqrt((s.x - SHEET_WIDTH / 2) ** 2 + (s.y - HOUSE_CENTER_Y) ** 2))
          .sort((a, b) => a - b)[0] ?? Infinity;

        const tryTakeout = playerBest < FOUR_FOOT_R && Math.random() < 0.4;
        if (tryTakeout) {
          const target = sheetStonesRef.current
            .filter(s => s.owner === 'player')
            .sort((a, b) => {
              const da = Math.sqrt((a.x - SHEET_WIDTH / 2) ** 2 + (a.y - HOUSE_CENTER_Y) ** 2);
              const db = Math.sqrt((b.x - SHEET_WIDTH / 2) ** 2 + (b.y - HOUSE_CENTER_Y) ** 2);
              return da - db;
            })[0];
          if (target) {
            const dx = target.x - SHEET_WIDTH / 2;
            angle = Math.atan2(dx * 0.3, STONE_START_Y - target.y) + (Math.random() - 0.5) * 0.04;
            power = 70 + Math.random() * 20;
          } else {
            angle = (Math.random() - 0.5) * 0.06;
            power = 58 + Math.random() * 12;
          }
        } else {
          angle = (Math.random() - 0.5) * 0.06;
          power = 58 + Math.random() * 12;
        }
      }

      if (!cancelled) startSlide(power, angle);
    };

    // Brief visible delay before the computer throws
    const timer = setTimeout(doThrow, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [state, isArcade, startSlide]);

  // ── Drag handlers (slingshot interaction) ──────────────────────

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (state !== 'idle') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Only start drag if touching near the stone
    const distToStone = Math.sqrt((x - stoneX) ** 2 + (y - stoneY) ** 2);
    if (distToStone < DRAG_HIT_RADIUS) {
      setDragStart({ x, y });
      setDragCurrent({ x, y });
      setState('charging'); // reuse charging state for drag
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  }, [state, stoneX, stoneY]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || state !== 'charging') return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragCurrent({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, [dragStart, state]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || !dragCurrent || state !== 'charging') return;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }

    // Drag UP toward target = power. Horizontal drag = aim angle.
    // dx = how far right/left the finger moved
    // dy = how far UP the finger moved (negative = upward on screen)
    const dx = dragCurrent.x - dragStart.x;
    const dy = dragStart.y - dragCurrent.y; // positive = dragged upward
    const dragDist = Math.sqrt(dx * dx + dy * dy);

    if (dragDist < 10 || dy < 5) {
      // Not enough upward drag — cancel
      setState('idle');
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    // Power from vertical drag distance (how far up they dragged)
    const power = Math.min((dy / MAX_DRAG_DISTANCE) * MAX_POWER, MAX_POWER);
    // Angle from horizontal offset — small angle, stone mostly goes straight
    const angle = Math.atan2(dx * 0.3, dy); // dampen horizontal for subtle aim

    setDragStart(null);
    setDragCurrent(null);
    startSlide(power, angle);
  }, [dragStart, dragCurrent, state, startSlide]);

  const handlePointerCancel = useCallback(() => {
    if (state === 'charging') {
      setState('idle');
      setDragStart(null);
      setDragCurrent(null);
    }
  }, [state]);

  // ── Sweep handler ──────────────────────────────────────────────

  const handleSweep = useCallback(() => {
    if (state !== 'sliding') return;
    // Stackable: extend from current time OR from the existing end, whichever is later.
    // Rapid taps chain into sustained sweeping.
    const now = globalThis.performance.now();
    sweptUntilRef.current = Math.max(sweptUntilRef.current, now) + SWEEP_DURATION_MS;
    setSweepCount(c => c + 1);
    // Add sweep marks behind the stone
    const marks: SweepMark[] = [];
    for (let i = 0; i < 4; i++) {
      marks.push({
        x: stoneXRef.current + (Math.random() - 0.5) * 16,
        y: stoneYRef.current + STONE_SIZE / 2 + 6 + i * 8,
        opacity: 1,
      });
    }
    setSweepMarks(prev => [...prev, ...marks]);
  }, [state]);

  // ── Drag visual computations ───────────────────────────────────

  // Compute drag power and trajectory for rendering
  // Power from upward drag distance only (not total distance)
  const dragPower = dragStart && dragCurrent
    ? Math.min(Math.max(0, dragStart.y - dragCurrent.y) / MAX_DRAG_DISTANCE * 100, 100)
    : 0;

  // Trajectory line: shows where the stone will GO (forward/up toward target)
  const trajectoryEnd = dragStart && dragCurrent && dragPower > 5
    ? (() => {
      const dx = dragCurrent.x - dragStart.x;  // horizontal aim
      const dy = dragStart.y - dragCurrent.y;   // vertical (positive = up)
      const dragDist = Math.sqrt(dx * dx + dy * dy);
      if (dragDist < 1) return null;
      // Direction: up the sheet with slight horizontal from aim
      const aimX = dx * 0.3; // dampen horizontal same as launch
      const norm = Math.sqrt(aimX * aimX + dy * dy);
      if (norm < 1) return null;
      const nx = aimX / norm;
      const ny = -dy / norm; // negative because screen Y is inverted
      const projLen = Math.min(dragPower * 2.5, 200);
      return {
        x: Math.max(5, Math.min(SHEET_WIDTH - 5, stoneX + nx * projLen)),
        y: Math.max(5, Math.min(SHEET_HEIGHT - 5, stoneY + ny * projLen)),
      };
    })()
    : null;

  // ── Render ──────────────────────────────────────────────────────

  const resultColor = result
    ? result.multiplier >= 3 ? colors.medal.gold
      : result.multiplier >= 2 ? colors.brand.primary
        : result.multiplier >= 1 ? colors.brand.secondary
          : colors.text.disabled
    : colors.text.disabled;

  return (
    <Card ref={rootRef} sx={{
      overflow: 'hidden', borderRadius: 3,
      border: `2px solid ${alpha('#64b5f6', 0.5)}`,
      boxShadow: `0 0 20px ${alpha('#64b5f6', 0.15)}`,
      scrollMarginTop: 16,
    }}>
      {/* Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
        color: 'white', px: 2, py: 1.25,
        display: 'flex', alignItems: 'center', gap: 1,
      }}>
        <AcUnitIcon sx={{ fontSize: 20 }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, letterSpacing: 1 }}>
          CURLING
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: 'white', p: 0.5 }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* The ice sheet — shown during the throw. After lock-in we swap
          to the question panel below. */}
      {(state === 'idle' || state === 'charging' || state === 'sliding' || state === 'result' || state === 'computerTurn' || state === 'endScore') && (
      <Box
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleSweep}
        sx={{
          position: 'relative', height: SHEET_HEIGHT, maxWidth: SHEET_WIDTH, mx: 'auto',
          background: 'linear-gradient(180deg, #e3f2fd 0%, #bbdefb 50%, #90caf9 100%)',
          cursor: state === 'idle' ? 'grab' : state === 'charging' ? 'grabbing' : state === 'sliding' ? 'pointer' : 'default',
          overflow: 'hidden',
          userSelect: 'none',
          touchAction: 'none',
        }}
      >
        {/* Ice shine overlay */}
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.4) 50%, transparent 60%)',
          animation: `${iceShine} 6s ease-in-out infinite`,
          pointerEvents: 'none',
        }} />

        {/* The house — 4 concentric rings: 12ft(blue), 8ft(white),
            4ft(red), button(blue). Proportions match real curling. */}
        <Box sx={{
          position: 'absolute', left: '50%', top: HOUSE_CENTER_Y,
          transform: 'translate(-50%, -50%)',
          width: TWELVE_FOOT_R * 2, height: TWELVE_FOOT_R * 2, borderRadius: '50%',
          bgcolor: '#1565c0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: `inset 0 0 20px ${alpha('#0d47a1', 0.3)}`,
        }}>
          <Box sx={{
            position: 'absolute',
            width: EIGHT_FOOT_R * 2, height: EIGHT_FOOT_R * 2, borderRadius: '50%',
            bgcolor: '#fff',
            boxShadow: `inset 0 0 8px ${alpha('#000', 0.06)}`,
          }} />
          <Box sx={{
            position: 'absolute',
            width: FOUR_FOOT_R * 2, height: FOUR_FOOT_R * 2, borderRadius: '50%',
            bgcolor: '#d32f2f',
            boxShadow: `inset 0 0 10px ${alpha('#b71c1c', 0.3)}`,
          }} />
          <Box sx={{
            position: 'absolute',
            width: BULLSEYE_R * 2, height: BULLSEYE_R * 2, borderRadius: '50%',
            bgcolor: '#1565c0',
          }} />
          {/* Crosshair lines — clipped to the circle by overflow:hidden */}
          <Box sx={{ position: 'absolute', width: '100%', height: 1, bgcolor: alpha('#000', 0.12) }} />
          <Box sx={{ position: 'absolute', width: 1, height: '100%', bgcolor: alpha('#000', 0.12) }} />
        </Box>

        {/* Ring legend — small colored dots + multipliers between house and hog line */}
        <Box sx={{
          position: 'absolute',
          left: '50%', top: HOUSE_CENTER_Y + TWELVE_FOOT_R + 16,
          transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 1.5,
          pointerEvents: 'none',
        }}>
          {[
            { color: '#1565c0', label: '3×', desc: 'Button' },
            { color: '#d32f2f', label: '2×', desc: '4ft' },
            { color: '#e0e0e0', label: '1.5×', desc: '8ft' },
            { color: '#1565c0', label: '1×', desc: '12ft' },
          ].map(ring => (
            <Box key={ring.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Box sx={{
                width: 7, height: 7, borderRadius: '50%', bgcolor: ring.color,
                border: ring.color === '#e0e0e0' ? `1px solid ${alpha('#000', 0.2)}` : 'none',
              }} />
              <Typography sx={{
                fontSize: '0.5rem', fontWeight: 700,
                color: alpha('#000', 0.45), letterSpacing: 0.3,
              }}>
                {ring.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Tee line (horizontal through the button) */}
        <Box sx={{
          position: 'absolute', left: 0, right: 0,
          top: HOUSE_CENTER_Y, height: 1,
          bgcolor: alpha('#000', 0.08),
          pointerEvents: 'none',
        }} />

        {/* Back line (behind the house) */}
        <Box sx={{
          position: 'absolute', left: 0, right: 0,
          top: HOUSE_CENTER_Y - TWELVE_FOOT_R - 12, height: 2,
          bgcolor: alpha('#c62828', 0.35),
          pointerEvents: 'none',
        }} />

        {/* Hog line (must release before this line) */}
        <Box sx={{
          position: 'absolute', left: 0, right: 0,
          top: HOUSE_CENTER_Y + TWELVE_FOOT_R + 50, height: 2,
          bgcolor: alpha('#c62828', 0.35),
          pointerEvents: 'none',
        }} />

        {/* Trajectory line during drag */}
        {state === 'charging' && trajectoryEnd && (
          <svg
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            <line
              x1={stoneX}
              y1={stoneY}
              x2={trajectoryEnd.x}
              y2={trajectoryEnd.y}
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={2}
              strokeDasharray="6,4"
            />
            {/* Endpoint dot */}
            <circle
              cx={trajectoryEnd.x}
              cy={trajectoryEnd.y}
              r={4}
              fill="rgba(0,0,0,0.3)"
            />
          </svg>
        )}

        {/* Power indicator during drag */}
        {state === 'charging' && dragPower > 5 && (
          <Box sx={{
            position: 'absolute',
            left: stoneX + 22,
            top: stoneY - 10,
            pointerEvents: 'none',
            zIndex: 5,
          }}>
            <Typography sx={{
              fontSize: '0.75rem',
              fontWeight: 800,
              color: dragPower < 40
                ? '#2196f3'
                : dragPower < 75
                  ? '#4caf50'
                  : '#f44336',
              textShadow: '0 1px 2px rgba(255,255,255,0.8)',
            }}>
              {Math.round(dragPower)}%
            </Typography>
          </Box>
        )}

        {/* Sheet stones — in arcade: colored by owner. In trivia: all yellow (opponents). */}
        {opponentStones.map((os, i) => {
          const owner = isArcade && sheetStones[i] ? sheetStones[i].owner : 'opponent';
          const isPlayer = owner === 'player';
          const stoneGradient = isPlayer
            ? 'radial-gradient(circle at 30% 30%, #6d4c41, #3e2723)'  // brown (matches player)
            : 'radial-gradient(circle at 30% 30%, #ffd54f, #f9a825, #e65100)'; // gold (opponent/computer)
          const stoneBorder = isPlayer ? '2px solid #fff3e0' : '2px solid #fff8e1';
          return (
            <React.Fragment key={i}>
              <Box sx={{
                position: 'absolute',
                left: os.x, top: os.y + 2,
                transform: 'translate(-50%, -50%)',
                width: OPPONENT_STONE_SIZE, height: OPPONENT_STONE_SIZE,
                borderRadius: '50%',
                bgcolor: alpha('#000', 0.15),
                pointerEvents: 'none', filter: 'blur(2px)',
              }} />
              <Box sx={{
                position: 'absolute',
                left: os.x, top: os.y,
                transform: 'translate(-50%, -50%)',
                width: OPPONENT_STONE_SIZE, height: OPPONENT_STONE_SIZE,
                borderRadius: '50%',
                background: stoneGradient,
                border: stoneBorder,
                boxShadow: '0 2px 4px rgba(0,0,0,0.3), inset 0 -2px 3px rgba(0,0,0,0.2)',
                pointerEvents: 'none', zIndex: 2,
              }} />
            </React.Fragment>
          );
        })}

        {/* Knockout texts */}
        {knockoutTexts.map(kt => (
          <Typography key={kt.id} sx={{
            position: 'absolute',
            left: kt.x,
            top: kt.y,
            transform: 'translate(-50%, -50%)',
            fontSize: '0.7rem',
            fontWeight: 900,
            color: '#ff6f00',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
            pointerEvents: 'none',
            animation: `${knockoutPop} 1.2s ease-out forwards`,
            zIndex: 20,
            whiteSpace: 'nowrap',
          }}>
            +{kt.pts} KNOCKOUT!
          </Typography>
        ))}

        {/* Sweep marks — fading white dashes */}
        {sweepMarks.map((mark, i) => (
          <Box key={i} sx={{
            position: 'absolute',
            left: mark.x - 8,
            top: mark.y,
            width: 16,
            height: 2,
            bgcolor: alpha('#fff', mark.opacity * 0.9),
            borderRadius: 1,
            pointerEvents: 'none',
            zIndex: 1,
          }} />
        ))}

        {/* Stone shadow */}
        <Box sx={{
          position: 'absolute', left: stoneX, top: stoneY + 2,
          transform: 'translate(-50%, -50%)',
          width: STONE_SIZE, height: STONE_SIZE, borderRadius: '50%',
          bgcolor: alpha('#000', 0.2),
          pointerEvents: 'none',
          filter: 'blur(2px)',
        }} />

        {/* The stone */}
        <Box sx={{
          position: 'absolute', left: stoneX, top: stoneY,
          transform: 'translate(-50%, -50%)',
          width: STONE_SIZE, height: STONE_SIZE, borderRadius: '50%',
          background: 'radial-gradient(circle at 30% 30%, #6d4c41, #3e2723)',
          boxShadow: `0 2px 4px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3)`,
          border: '2px solid #fff3e0',
          zIndex: 3,
          // Handle (little red knob on top)
          '&::before': {
            content: '""',
            position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 6, borderRadius: '3px 3px 0 0',
            bgcolor: '#c62828',
          },
          // Sweep trail when sweeping
          ...(state === 'sliding' && sweepCount > 0 && {
            boxShadow: `0 2px 4px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(255,255,255,0.6)`,
          }),
          // Glow when being dragged
          ...(state === 'charging' && {
            boxShadow: `0 2px 4px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.3), 0 0 12px rgba(33,150,243,0.5)`,
          }),
        }} />

        {/* Live distance + sweep hint during slide */}
        {state === 'sliding' && (() => {
          const ddx = stoneX - SHEET_WIDTH / 2;
          const ddy = stoneY - HOUSE_CENTER_Y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          const precision = Math.max(0, Math.round(100 - dist));
          const distDisplay = Math.round(dist);
          const inHouse = dist <= OUTER_R;
          const scoreColor = dist <= BULLSEYE_R ? '#4caf50'
            : dist <= INNER_R ? '#8bc34a'
            : dist <= OUTER_R ? '#ffeb3b'
            : dist <= 120 ? '#ff9800'
            : '#f44336';

          return (
            <>
              {/* Live distance tracker — bottom-right corner, out of the way */}
              <Box sx={{
                position: 'absolute', right: 8, bottom: 50,
                pointerEvents: 'none', textAlign: 'center',
                bgcolor: alpha('#000', 0.65),
                color: '#fff', px: 1.5, py: 0.5, borderRadius: 2,
                backdropFilter: 'blur(6px)',
                minWidth: 70,
                border: `2px solid ${alpha(scoreColor, 0.6)}`,
                transition: 'border-color 0.1s',
              }}>
                {/* Distance countdown */}
                <Typography sx={{
                  fontSize: '0.55rem', fontWeight: 600, opacity: 0.7,
                  letterSpacing: 1, mb: 0.25,
                }}>
                  {distDisplay > OUTER_R ? 'APPROACHING' : inHouse ? 'IN THE HOUSE' : 'CLOSE'}
                </Typography>

                {/* Score number */}
                <Typography sx={{
                  fontSize: '1.2rem', fontWeight: 900, lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  color: scoreColor,
                  transition: 'color 0.1s',
                }}>
                  {inHouse ? precision : distDisplay}
                </Typography>

                {/* Label */}
                <Typography sx={{
                  fontSize: '0.5rem', fontWeight: 700, opacity: 0.8,
                  letterSpacing: 1.5, mt: 0.2,
                }}>
                  {inHouse ? 'PRECISION' : `${distDisplay}px AWAY`}
                </Typography>

                {/* Zone indicator when in house */}
                {inHouse && (
                  <Typography sx={{
                    fontSize: '0.55rem', fontWeight: 700,
                    color: scoreColor, mt: 0.25,
                  }}>
                    {dist <= BULLSEYE_R ? 'BUTTON!' : dist <= INNER_R ? 'Inner Ring' : 'Outer Ring'}
                  </Typography>
                )}
              </Box>

              {/* Sweep hint */}
              <Box sx={{
                position: 'absolute', left: '50%', bottom: 20,
                transform: 'translateX(-50%)',
                fontSize: '0.72rem', fontWeight: 600,
                color: alpha('#000', 0.6),
                bgcolor: alpha('#fff', 0.7),
                px: 1.5, py: 0.5, borderRadius: 2,
                pointerEvents: 'none',
                backdropFilter: 'blur(4px)',
              }}>
                Tap to sweep{' '}
                {sweepCount > 0 && (
                  <Box component="span" sx={{
                    display: 'inline-block',
                    animation: `${sweepPulse} 300ms ease-out`,
                    fontWeight: 800,
                  }}>
                    {`\u00B7 ${sweepCount}x`}
                  </Box>
                )}
              </Box>
            </>
          );
        })()}

        {/* Bullseye celebration */}
        {state === 'result' && result && result.precisionScore >= 95 && (
          <Typography sx={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '1.5rem', fontWeight: 900,
            color: '#ffd700',
            textShadow: '0 0 10px rgba(255,215,0,0.8), 0 2px 4px rgba(0,0,0,0.5)',
            animation: `${bullseyeCelebrate} 1.5s ease-out forwards`,
            pointerEvents: 'none',
            zIndex: 15,
            letterSpacing: 2,
          }}>
            BULLSEYE!
          </Typography>
        )}

        {/* Result banner — slides in at the bottom, no full-screen overlay */}
        {state === 'result' && result && (
          <Box sx={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            px: 2, py: 1.25,
            background: `linear-gradient(180deg, transparent, ${alpha('#000', 0.7)} 20%)`,
            display: 'flex', alignItems: 'center', gap: 1.5,
            animation: `${resultPop} 400ms ${motion.ease.bounce}`,
            pointerEvents: 'none',
          }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '50%',
              bgcolor: resultColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 16px ${alpha(resultColor, 0.5)}`,
              flexShrink: 0,
              ...(result.multiplier >= 3 && {
                background: 'linear-gradient(135deg, #ffd700, #ffa000, #ffd700)',
                backgroundSize: '200% auto',
                animation: `${shimmer} 2s linear infinite`,
              }),
            }}>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff' }}>
                {result.multiplier}×
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>
                {result.zone}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography sx={{
                  fontSize: '0.68rem', fontWeight: 600,
                  color: result.precisionScore >= 80 ? '#81c784' : result.precisionScore >= 50 ? '#ffb74d' : alpha('#fff', 0.6),
                }}>
                  Precision {result.precisionScore}
                </Typography>
                {result.knockouts > 0 && (
                  <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#ffb74d' }}>
                    {result.knockouts} KO
                  </Typography>
                )}
                {sweepCount > 0 && (
                  <Typography sx={{ fontSize: '0.6rem', color: alpha('#fff', 0.4) }}>
                    {sweepCount} sweeps
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
      )}

      {/* Question panel — shown once the multiplier is locked */}
      {(state === 'locking' || state === 'question' || state === 'submitting' || state === 'answered') && (
        <Box sx={{ p: 2, bgcolor: '#f5fafd', borderBottom: `1px solid ${alpha('#64b5f6', 0.15)}` }}>
          {/* Multiplier chip + category */}
          {result && (
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
                {result.multiplier}x LOCKED
              </Box>
              {question && (
                <Typography sx={{
                  fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {question.category}
                </Typography>
              )}
            </Box>
          )}

          {state === 'locking' && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: 1, fontWeight: 600 }}>
                Generating your question...
              </Typography>
              <LoadingDots />
            </Box>
          )}

          {(state === 'question' || state === 'submitting' || state === 'answered') && question && (
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
                  const isCorrect = state === 'answered' && answerResult?.correctAnswer === choice;
                  const isWrong = state === 'answered' && isSelected && !answerResult?.correct;
                  return (
                    <Button
                      key={choice}
                      fullWidth
                      disabled={state !== 'question'}
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

              {state === 'answered' && answerResult && (
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

      {/* Controls — bottom area */}
      <Box sx={{ p: 2, pb: 'calc(16px + env(safe-area-inset-bottom, 0px))', bgcolor: '#fafafa', touchAction: 'none', userSelect: 'none' }}>
        {/* Arcade scoreboard */}
        {isArcade && state !== 'gameOver' && (
          <Box sx={{
            display: 'flex', justifyContent: 'center', gap: 2, mb: 1,
            fontSize: '0.7rem', fontWeight: 700,
          }}>
            <Box sx={{ color: '#3e2723' }}>Score: {arcadeScore}</Box>
            <Box sx={{ color: 'text.disabled' }}>End {currentEnd}/{TOTAL_ENDS}</Box>
            {lastThrowScore > 0 && state === 'idle' && (
              <Box sx={{ color: colors.brand.primary }}>+{lastThrowScore}</Box>
            )}
          </Box>
        )}

        {state === 'idle' && (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center', fontWeight: 600 }}>
            {isArcade ? `Your throw (${Math.floor(throwNum / 2) + 1} of 2)` : 'Drag upward to aim and shoot'}
          </Typography>
        )}

        {state === 'charging' && (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center', fontWeight: 600 }}>
            Drag higher for more power — release to launch!
          </Typography>
        )}

        {state === 'sliding' && (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', textAlign: 'center', fontWeight: 600 }}>
            {currentThrower === 'computer' ? 'Computer throwing...' : (
              <>Tap the ice to sweep!{sweepCount > 0 && ` (${sweepCount}x)`}</>
            )}
          </Typography>
        )}

        {state === 'computerTurn' && (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', textAlign: 'center', fontWeight: 600 }}>
            Computer is thinking...
          </Typography>
        )}

        {state === 'result' && !isArcade && (
          <Typography sx={{
            fontSize: '0.75rem', color: 'text.secondary', textAlign: 'center',
            fontWeight: 600, letterSpacing: 0.5,
          }}>
            Locking in {result?.multiplier}x...
          </Typography>
        )}

        {state === 'endScore' && endResult && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 800, mb: 0.5 }}>
              {endResult.playerPts > endResult.computerPts
                ? `You score ${endResult.playerPts}!`
                : endResult.computerPts > endResult.playerPts
                  ? `Computer scores ${endResult.computerPts}`
                  : 'Blank end — no score'}
            </Typography>
            <Button
              variant="contained" color="primary" fullWidth
              onClick={() => {
                if (currentEnd >= TOTAL_ENDS) {
                  // Submit precision score to arcade leaderboard
                  submitArcadeScore(userId, 'curling', arcadeScoreRef.current).catch(() => {});
                  setState('gameOver');
                  return;
                }
                // Next end — clear sheet, reset throws
                setCurrentEnd(e => e + 1);
                throwNumRef.current = 0;
                setThrowNum(0);
                currentThrowerRef.current = 'player';
                setCurrentThrower('player');
                sheetStonesRef.current = [];
                setSheetStones([]);
                opponentStonesRef.current = [];
                setOpponentStones([]);
                stoneYRef.current = STONE_START_Y;
                stoneXRef.current = SHEET_WIDTH / 2;
                setStoneY(STONE_START_Y);
                setStoneX(SHEET_WIDTH / 2);
                setEndResult(null);
                setState('idle');
              }}
              sx={{ borderRadius: `${radii.md}px`, fontWeight: 700, mt: 1 }}
            >
              {currentEnd >= TOTAL_ENDS ? 'See Final Score' : `Next End (${currentEnd + 1}/${TOTAL_ENDS})`}
            </Button>
          </Box>
        )}

        {state === 'gameOver' && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, mb: 0.25 }}>
              {playerTotal > computerTotal ? 'You Win!' : playerTotal < computerTotal ? 'Computer Wins' : 'Tie Game!'}
            </Typography>
            <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 0.5 }}>
              Curling: You {playerTotal} — {computerTotal} CPU
            </Typography>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, color: colors.brand.primary, mb: 1.5 }}>
              Precision Score: {arcadeScore}
            </Typography>
            <Button
              fullWidth variant="contained" color="primary"
              onClick={() => {
                // Reset everything for a new game
                setCurrentEnd(1);
                setPlayerTotal(0);
                setComputerTotal(0);
                arcadeScoreRef.current = 0;
                setArcadeScore(0);
                setLastThrowScore(0);
                throwNumRef.current = 0;
                setThrowNum(0);
                currentThrowerRef.current = 'player';
                setCurrentThrower('player');
                sheetStonesRef.current = [];
                setSheetStones([]);
                opponentStonesRef.current = [];
                setOpponentStones([]);
                stoneYRef.current = STONE_START_Y;
                stoneXRef.current = SHEET_WIDTH / 2;
                setStoneY(STONE_START_Y);
                setStoneX(SHEET_WIDTH / 2);
                setResult(null);
                setEndResult(null);
                setState('idle');
              }}
              sx={{ borderRadius: `${radii.md}px`, fontWeight: 700, mb: 1 }}
            >
              Play Again
            </Button>
            <Button
              fullWidth variant="outlined" size="small"
              onClick={onClose}
              sx={{ borderRadius: `${radii.md}px`, fontSize: '0.75rem' }}
            >
              Back to Arcade
            </Button>
          </Box>
        )}

        {state === 'answered' && !isArcade && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 800, mb: 0.5 }}>
              {result?.precisionScore ?? 0} points
            </Typography>
            <Button fullWidth variant="outlined" size="small" onClick={onClose}
              sx={{ borderRadius: `${radii.md}px`, fontSize: '0.75rem' }}>
              Done
            </Button>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default CurlingGame;
