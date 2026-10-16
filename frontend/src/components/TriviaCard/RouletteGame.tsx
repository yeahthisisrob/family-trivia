/**
 * RouletteGame — casino roulette with animated wheel + bouncing ball.
 *
 * Canvas-rendered wheel with 37 pockets (European: 0-36).
 * Ball orbits, decelerates, bounces between pockets, and settles.
 * Bets: single number (35:1), red/black (1:1), odd/even (1:1).
 * Uses shared casino credit pool.
 */

import CasinoIcon from '@mui/icons-material/Casino';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, IconButton, keyframes, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getCasinoBalance, updateCasinoBalance } from '../../api/modules/casino';
import { colors } from '../../shared/design-system/tokens/colors';
import { games } from '../../shared/design-system/tokens/games';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('RouletteGame');

// ── Theme ───────────────────────────────────────────────────────

const art = games.roulette;
const gold = art.gold;
const darkBg = art.cabinet;
const frameBg = art.frame;

// ── Roulette data ───────────────────────────────────────────────

const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14,
  31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const RED_NUMS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function numColor(n: number): string {
  if (n === 0) return art.pocketZero;
  return RED_NUMS.has(n) ? art.pocketRed : art.pocketBlack;
}

const POCKET_COUNT = WHEEL_ORDER.length; // 37
const POCKET_ANGLE = (2 * Math.PI) / POCKET_COUNT;

type BetType = 'number' | 'red' | 'black' | 'odd' | 'even';

interface Bet {
  type: BetType;
  number?: number;
  amount: number;
}

function calcPayout(bet: Bet, result: number): number {
  switch (bet.type) {
    case 'number':
      return bet.number === result ? bet.amount * 36 : 0;
    case 'red':
      return result !== 0 && RED_NUMS.has(result) ? bet.amount * 2 : 0;
    case 'black':
      return result !== 0 && !RED_NUMS.has(result) ? bet.amount * 2 : 0;
    case 'odd':
      return result !== 0 && result % 2 === 1 ? bet.amount * 2 : 0;
    case 'even':
      return result !== 0 && result % 2 === 0 ? bet.amount * 2 : 0;
  }
}

// ── Animations ──────────────────────────────────────────────────

const resultPop = keyframes`
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
`;

const balanceBump = keyframes`
  0%   { transform: scale(1); }
  30%  { transform: scale(1.35); }
  100% { transform: scale(1); }
`;

function vibrate(ms = 10) {
  try {
    navigator?.vibrate?.(ms);
  } catch {
    /* ok */
  }
}

// ── Wheel drawing ───────────────────────────────────────────────

function drawWheel(ctx: CanvasRenderingContext2D, size: number, rotation: number) {
  const cx = size / 2,
    cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.65;

  ctx.clearRect(0, 0, size, size);

  // Outer rim
  ctx.beginPath();
  ctx.arc(cx, cy, outerR + 2, 0, Math.PI * 2);
  ctx.fillStyle = art.wheelRim;
  ctx.fill();

  // Pockets
  for (let i = 0; i < POCKET_COUNT; i++) {
    const startAngle = rotation + i * POCKET_ANGLE - POCKET_ANGLE / 2;
    const endAngle = startAngle + POCKET_ANGLE;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = numColor(WHEEL_ORDER[i]);
    ctx.fill();
    ctx.strokeStyle = alpha(colors.onColor, 0.15);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  // Numbers
  ctx.fillStyle = colors.onColor;
  ctx.font = `bold ${Math.round(size * 0.036)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < POCKET_COUNT; i++) {
    const angle = rotation + i * POCKET_ANGLE;
    const r = (outerR + innerR) / 2 + 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(String(WHEEL_ORDER[i]), 0, 0);
    ctx.restore();
  }

  // Center hub
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = art.hub;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, innerR * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = gold;
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, size: number, angle: number, radius: number) {
  const cx = size / 2,
    cy = size / 2;
  const x = cx + Math.cos(angle) * radius;
  const y = cy + Math.sin(angle) * radius;
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = art.ball;
  ctx.fill();
  ctx.strokeStyle = art.ballEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
  // Shine
  ctx.beginPath();
  ctx.arc(x - 1.5, y - 1.5, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = art.ballHighlight;
  ctx.fill();
}

function drawPointer(ctx: CanvasRenderingContext2D, size: number) {
  const cx = size / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 8, 2);
  ctx.lineTo(cx + 8, 2);
  ctx.lineTo(cx, 16);
  ctx.closePath();
  ctx.fillStyle = gold;
  ctx.fill();
  ctx.strokeStyle = art.pointerEdge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ── Component ───────────────────────────────────────────────────

type Phase = 'loading' | 'betting' | 'spinning' | 'result';

const BET_AMOUNTS = [1, 5, 10, 25];

interface RouletteGameProps {
  userId: string;
  onClose: () => void;
}

const RouletteGame: React.FC<RouletteGameProps> = ({ userId, onClose }) => {
  const [phase, setPhase] = useState<Phase>('loading');
  const [balance, setBalance] = useState(0);
  const [floorVal, setFloorVal] = useState(0);
  const [betAmount, setBetAmount] = useState(5);
  const [betType, setBetType] = useState<BetType>('red');
  const [betNumber, setBetNumber] = useState(17);
  const [result, setResult] = useState<number | null>(null);
  const [payout, setPayout] = useState(0);
  const [balanceAnim, setBalanceAnim] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const WHEEL_SIZE = 280;

  // ── Load balance ──────────────────────────────────────────────
  useEffect(() => {
    getCasinoBalance(userId)
      .then((r) => {
        setBalance(r.balance);
        setFloorVal(r.floor);
        setPhase('betting');
      })
      .catch(() => {
        setBalance(10);
        setPhase('betting');
      });
  }, [userId]);

  // ── Draw static wheel ─────────────────────────────────────────
  const drawStatic = useCallback(
    (rot = -Math.PI / 2) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawWheel(ctx, WHEEL_SIZE, rot);
      drawPointer(ctx, WHEEL_SIZE);
    },
    [WHEEL_SIZE],
  );

  useEffect(() => {
    if (phase === 'betting' || phase === 'loading') drawStatic();
  }, [phase, drawStatic]);

  // ── Spin ──────────────────────────────────────────────────────
  const spin = useCallback(() => {
    if (balance < betAmount) return;
    vibrate();

    const bet: Bet = {
      type: betType,
      number: betType === 'number' ? betNumber : undefined,
      amount: betAmount,
    };
    setBalance((b) => b - betAmount);
    setPhase('spinning');
    setResult(null);
    setPayout(0);

    // Pick random result
    const winIdx = Math.floor(Math.random() * POCKET_COUNT);
    const winNum = WHEEL_ORDER[winIdx];

    // Animate: wheel spins 3-5 full rotations + offset to land winIdx at top
    const targetAngle = -Math.PI / 2 - winIdx * POCKET_ANGLE;
    const totalSpin = (3 + Math.random() * 2) * Math.PI * 2 + targetAngle;
    const spinDuration = 3500;
    const ballOrbitR = WHEEL_SIZE / 2 - 8;
    const ballSettleR = (WHEEL_SIZE / 2 - 4) * 0.82;

    const start = performance.now();
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / spinDuration, 1);
      // Ease-out cubic
      const ease = 1 - (1 - t) ** 3;
      const wheelRot = ease * totalSpin;

      drawWheel(ctx, WHEEL_SIZE, wheelRot);
      drawPointer(ctx, WHEEL_SIZE);

      // Ball: orbits opposite direction, then settles into pocket
      const ballPhase = t < 0.6 ? 'orbiting' : t < 0.85 ? 'dropping' : 'settled';
      if (ballPhase === 'orbiting') {
        const ballAngle = -wheelRot * 1.3 + Math.PI;
        drawBall(ctx, WHEEL_SIZE, ballAngle, ballOrbitR);
      } else if (ballPhase === 'dropping') {
        const dropT = (t - 0.6) / 0.25;
        const bounce = Math.abs(Math.sin(dropT * Math.PI * 3)) * (1 - dropT);
        const r = ballOrbitR - (ballOrbitR - ballSettleR) * dropT + bounce * 12;
        const settleAngle = wheelRot + winIdx * POCKET_ANGLE;
        const wobble = Math.sin(dropT * Math.PI * 5) * (1 - dropT) * POCKET_ANGLE * 0.8;
        drawBall(ctx, WHEEL_SIZE, settleAngle + wobble, r);
      } else {
        const settleAngle = wheelRot + winIdx * POCKET_ANGLE;
        drawBall(ctx, WHEEL_SIZE, settleAngle, ballSettleR);
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        // Done — show result
        const p = calcPayout(bet, winNum);
        setResult(winNum);
        setPayout(p);
        setBalance((b) => {
          const nb = b + p;
          setBalanceAnim(true);
          setTimeout(() => setBalanceAnim(false), 500);
          return nb;
        });
        if (p > 0) vibrate(25);
        else vibrate(40);
        setPhase('result');
      }
    };

    animRef.current = requestAnimationFrame(animate);
  }, [balance, betAmount, betType, betNumber, WHEEL_SIZE, drawStatic]);

  useEffect(() => () => cancelAnimationFrame(animRef.current), []);

  // ── End session ───────────────────────────────────────────────
  const endSession = useCallback(async () => {
    try {
      await updateCasinoBalance(userId, balance);
    } catch (err) {
      logger.error('Failed to sync casino balance', err);
    }
    onClose();
  }, [userId, balance, onClose]);

  const isBusted = balance <= 0 && phase === 'betting';
  const isWin = payout > 0;

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', width: '100%', userSelect: 'none' }}>
      <Box
        sx={{
          bgcolor: darkBg,
          borderRadius: 3,
          border: `3px solid ${gold}`,
          overflow: 'hidden',
          boxShadow: `0 10px 40px ${alpha(colors.scrim, 0.6)}, inset 0 1px 0 ${alpha(gold, 0.2)}`,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            bgcolor: frameBg,
            py: 1,
            px: 2,
            borderBottom: `2px solid ${gold}`,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', color: alpha(colors.onColor, 0.55) }}>
              CREDITS{' '}
              <Box
                component="span"
                sx={{
                  color: gold,
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  display: 'inline-block',
                  animation: balanceAnim ? `${balanceBump} 0.4s ease-out` : 'none',
                }}
              >
                {balance}
              </Box>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CasinoIcon sx={{ color: gold, fontSize: 18 }} />
            <Typography
              sx={{ fontWeight: 900, color: gold, fontSize: '0.95rem', letterSpacing: 2 }}
            >
              ROULETTE
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              onClick={endSession}
              sx={{ color: alpha(colors.onColor, 0.4), '&:hover': { color: colors.onColor } }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Wheel */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 2,
            bgcolor: art.table,
            borderLeft: `6px solid ${frameBg}`,
            borderRight: `6px solid ${frameBg}`,
          }}
        >
          {phase === 'loading' ? (
            <Box sx={{ height: WHEEL_SIZE, display: 'flex', alignItems: 'center' }}>
              <LoadingDots />
            </Box>
          ) : (
            <canvas
              ref={canvasRef}
              width={WHEEL_SIZE}
              height={WHEEL_SIZE}
              style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}
            />
          )}
        </Box>

        {/* Result banner */}
        {phase === 'result' && result !== null && (
          <Box
            sx={{
              textAlign: 'center',
              py: 1.5,
              bgcolor: isWin ? alpha(gold, 0.12) : alpha(art.loss, 0.1),
              borderTop: `1px solid ${alpha(gold, 0.15)}`,
              animation: `${resultPop} 0.4s ease-out`,
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: '50%',
                bgcolor: numColor(result),
                border: `3px solid ${gold}`,
                mb: 0.75,
              }}
            >
              <Typography sx={{ color: colors.onColor, fontWeight: 900, fontSize: '1.1rem' }}>
                {result}
              </Typography>
            </Box>
            <Typography
              sx={{
                fontWeight: 900,
                fontSize: '1rem',
                color: isWin ? gold : art.loss,
              }}
            >
              {isWin ? `Win! +${payout}` : 'No luck this time'}
            </Typography>
          </Box>
        )}

        {/* Betting controls */}
        <Box sx={{ px: 2, py: 1.5, bgcolor: alpha(colors.scrim, 0.2) }}>
          {isBusted ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 900, color: art.loss, mb: 1 }}>
                Out of credits!
              </Typography>
              <Button
                onClick={endSession}
                sx={{
                  bgcolor: gold,
                  color: darkBg,
                  fontWeight: 900,
                  textTransform: 'none',
                  borderRadius: `${radii.md}px`,
                }}
              >
                Back to Casino
              </Button>
            </Box>
          ) : (
            <>
              {/* Bet type */}
              <Typography
                sx={{
                  fontSize: '0.6rem',
                  color: alpha(colors.onColor, 0.4),
                  textTransform: 'uppercase',
                  letterSpacing: 1.5,
                  fontWeight: 700,
                  mb: 0.5,
                }}
              >
                Bet on
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, flexWrap: 'wrap' }}>
                {[
                  { type: 'red' as BetType, label: 'Red', color: art.pocketRed },
                  { type: 'black' as BetType, label: 'Black', color: art.pocketBlack },
                  { type: 'odd' as BetType, label: 'Odd', color: frameBg },
                  { type: 'even' as BetType, label: 'Even', color: frameBg },
                  { type: 'number' as BetType, label: `#${betNumber}`, color: numColor(betNumber) },
                ].map((opt) => {
                  const active = betType === opt.type;
                  return (
                    <Box
                      key={opt.type}
                      onClick={() => {
                        setBetType(opt.type);
                        vibrate();
                      }}
                      sx={{
                        px: 1.25,
                        py: 0.5,
                        borderRadius: `${radii.md}px`,
                        bgcolor: active ? opt.color : alpha(colors.onColor, 0.06),
                        border: `2px solid ${active ? gold : alpha(colors.onColor, 0.12)}`,
                        color: colors.onColor,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        ...(active && { boxShadow: `0 0 8px ${alpha(gold, 0.3)}` }),
                      }}
                    >
                      {opt.label}
                    </Box>
                  );
                })}
              </Box>

              {/* Number picker (only if betting on number) */}
              {betType === 'number' && (
                <Box sx={{ mb: 1.5 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      gap: 0.25,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
                    {Array.from({ length: 37 }, (_, i) => (
                      <Box
                        key={i}
                        onClick={() => {
                          setBetNumber(i);
                          vibrate();
                        }}
                        sx={{
                          width: 28,
                          height: 24,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: betNumber === i ? gold : numColor(i),
                          color: betNumber === i ? darkBg : colors.onColor,
                          fontSize: '0.55rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.1s',
                          border:
                            betNumber === i
                              ? `1px solid ${colors.onColor}`
                              : '1px solid transparent',
                        }}
                      >
                        {i}
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Bet amount */}
              <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', mb: 1.5 }}>
                {BET_AMOUNTS.filter((a) => a <= balance).map((a) => (
                  <Box
                    key={a}
                    onClick={() => {
                      setBetAmount(a);
                      vibrate();
                    }}
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        betAmount === a
                          ? `radial-gradient(circle at 35% 35%, ${art.chipGoldLight}, ${gold}, ${art.chipGoldDark})`
                          : `radial-gradient(circle at 35% 35%, ${art.chipIdleLight}, ${art.chipIdle}, ${art.chipIdleDark})`,
                      color: betAmount === a ? darkBg : alpha(colors.onColor, 0.7),
                      fontWeight: 900,
                      fontSize: '0.8rem',
                      border: `2px solid ${betAmount === a ? colors.onColor : alpha(colors.onColor, 0.12)}`,
                      cursor: 'pointer',
                      transition: 'all 0.12s',
                      boxShadow: betAmount === a ? `0 0 10px ${alpha(gold, 0.5)}` : 'none',
                    }}
                  >
                    {a}
                  </Box>
                ))}
              </Box>

              {/* Spin button */}
              <Button
                onClick={phase === 'result' ? () => setPhase('betting') : spin}
                disabled={phase === 'spinning'}
                fullWidth
                sx={{
                  bgcolor: gold,
                  color: darkBg,
                  fontWeight: 900,
                  py: 1.25,
                  borderRadius: `${radii.md}px`,
                  textTransform: 'none',
                  fontSize: '0.95rem',
                  boxShadow: `0 3px 10px ${alpha(gold, 0.3)}`,
                  '&:hover': { bgcolor: art.goldHover },
                  '&.Mui-disabled': { bgcolor: alpha(gold, 0.3), color: darkBg },
                }}
              >
                {phase === 'spinning'
                  ? 'Spinning...'
                  : phase === 'result'
                    ? 'Spin Again'
                    : `Spin — ${betAmount} credits`}
              </Button>
            </>
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            bgcolor: alpha(colors.scrim, 0.3),
            borderTop: `1px solid ${alpha(gold, 0.15)}`,
            px: 2,
            py: 0.5,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ fontSize: '0.6rem', color: alpha(colors.onColor, 0.35) }}>
            BET:{' '}
            <Box component="span" sx={{ color: gold, fontWeight: 800 }}>
              {betAmount}
            </Box>
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: alpha(colors.onColor, 0.35) }}>
            {betType === 'number' ? `#${betNumber} (35:1)` : `${betType} (1:1)`}
          </Typography>
          <Typography sx={{ fontSize: '0.6rem', color: alpha(colors.onColor, 0.35) }}>
            FLOOR:{' '}
            <Box component="span" sx={{ color: gold, fontWeight: 800 }}>
              {floorVal}
            </Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default RouletteGame;
