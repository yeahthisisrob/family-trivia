// File: src/components/TriviaCard/SlotMachine.tsx
// Casino-style slot machine — one SPIN button, auto-flow, no clutter.

import CancelIcon from '@mui/icons-material/Cancel';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  Button,
  IconButton,
  Typography,
  useTheme,
  alpha,
  keyframes,
} from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';

import { getCasinoBalance, updateCasinoBalance } from '../../api/modules/casino';
import {
  spinSlotMachine,
  getSlotMachineQuestion,
  submitSlotMachineAnswer,
  arcadeSlotSpin,
  type SlotMachineQuestion,
} from '../../api/modules/games';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('SlotMachine');

// ── Symbols ──────────────────────────────────────────────────────────
const SYMBOLS = ['🍒', '🍋', '🍉', '🍊', '🔔', '⭐', '7️⃣', '💎', '🍀'];
const REEL_HEIGHT = 80;
const BET_OPTIONS = [0.25, 1, 5, 25];
const PAYOUT_TABLE: Record<string, number> = {
  '🍒': 3, '🍋': 4, '🍉': 5, '🍊': 6, '🔔': 10, '⭐': 15, '7️⃣': 25, '💎': 50, '🍀': 100,
};

// ── Animations ───────────────────────────────────────────────────────
const glow = keyframes`
  0%, 100% { text-shadow: 0 0 10px #ffd700; }
  50% { text-shadow: 0 0 30px #ffd700, 0 0 50px #ffaa00; }
`;

const winFlash = keyframes`
  0%, 100% { opacity: 0.3; box-shadow: 0 0 4px #ffd700; }
  50% { opacity: 1; box-shadow: 0 0 20px #ffd700, 0 0 40px #ffaa00; }
`;

const leverPull = keyframes`
  0% { transform: translateY(0); }
  30% { transform: translateY(30px); }
  100% { transform: translateY(0); }
`;

const fadeUp = keyframes`
  0% { opacity: 0; transform: translateY(20px); }
  100% { opacity: 1; transform: translateY(0); }
`;

const confettiDrop = keyframes`
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(140px) rotate(720deg); opacity: 0; }
`;

// ── Confetti ─────────────────────────────────────────────────────────
const CONFETTI = Array.from({ length: 20 }, (_, i) => ({
  left: `${((i * 7919 + 104729) % 100)}%`,
  delay: `${(((i * 6271 + 32749) % 80) / 100).toFixed(2)}s`,
  color: ['#ffd700', '#ff4444', '#44ff44', '#4444ff', '#ff44ff'][i % 5],
  size: 4 + ((i * 4517 + 78901) % 60) / 10,
}));

// ── Reel component ───────────────────────────────────────────────────
interface ReelProps {
  targetIndex: number;
  spinning: boolean;
  stopDelay: number;
  overlayText?: string;
}

// CSS-only reel: spinning uses a continuous keyframe animation,
// stopped shows the target symbol at the correct offset.
// No useState/useEffect needed — pure render from props.
const reelSpinAnim = keyframes`
  from { transform: translateY(0); }
  to { transform: translateY(-${SYMBOLS.length * REEL_HEIGHT * 3}px); }
`;

const Reel: React.FC<ReelProps> = ({ targetIndex, spinning, stopDelay, overlayText }) => {
  const strip = React.useMemo(() => {
    const s: string[] = [];
    for (let i = 0; i < 15; i++) s.push(...SYMBOLS);
    return s;
  }, []);

  // Static offset: center the target symbol on the middle (payline) row
  const stoppedOffset = (Math.floor(strip.length / 2) + targetIndex) * REEL_HEIGHT - REEL_HEIGHT;

  return (
    <Box sx={{
      width: 80, height: REEL_HEIGHT * 3, overflow: 'hidden',
      borderRadius: 1.5, bgcolor: '#0a0a1a', position: 'relative',
      border: !spinning ? '2px solid #ffd700' : '2px solid #333',
      boxShadow: 'inset 0 0 20px rgba(0,0,0,0.9)',
      transition: 'border-color 0.3s',
    }}>
      {/* Symbol strip */}
      <Box sx={{
        ...(spinning ? {
          animation: `${reelSpinAnim} 0.4s linear infinite`,
          animationDelay: `${stopDelay * 0.1}s`,
        } : {
          transform: `translateY(-${stoppedOffset}px)`,
          transition: 'none',
        }),
        willChange: 'transform',
      }}>
        {strip.map((sym, i) => (
          <Box key={i} sx={{
            height: REEL_HEIGHT,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: sym === '7️⃣' ? 44 : 40,
            userSelect: 'none',
          }}>
            {sym}
          </Box>
        ))}
      </Box>

      {/* Glass overlay */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 35%, transparent 65%, rgba(0,0,0,0.4) 100%)',
      }} />

      {/* Text overlay (trivia mode: multiplier/category) */}
      {overlayText && !spinning && (
        <Box sx={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: alpha('#000', 0.75),
          animation: `${fadeUp} 0.3s ease-out`,
        }}>
          <Typography sx={{
            color: '#ffd700', fontWeight: 900,
            fontSize: overlayText.length > 6 ? '0.7rem' : '1.4rem',
            textShadow: '0 0 10px #ffd700',
            textAlign: 'center', px: 0.5,
          }}>
            {overlayText}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ── Props ─────────────────────────────────────────────────────────────
interface SlotMachineProps {
  userId: string;
  groupId: string;
  mode?: 'trivia' | 'arcade';
  onComplete?: (points: number) => void;
  onClose: () => void;
  isCatchingUp?: boolean;
}

// ── Main Component ────────────────────────────────────────────────────
export const SlotMachine: React.FC<SlotMachineProps> = ({
  userId,
  groupId,
  mode = 'trivia',
  onComplete,
  onClose,
  isCatchingUp = false,
}) => {
  const theme = useTheme();
  const isArcade = mode === 'arcade';

  // State
  const [spinning, setSpinning] = useState(false);
  const [reelTargets, setReelTargets] = useState([0, 1, 2]);
  const [showWin, setShowWin] = useState(false);
  const [winText, setWinText] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);

  // Trivia
  const [triviaMultiplier, setTriviaMultiplier] = useState(0);
  const [triviaCategory, setTriviaCategory] = useState('');
  const [question, setQuestion] = useState<SlotMachineQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState<boolean | null>(null);
  const [answerPoints, setAnswerPoints] = useState(0);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [showQuestion, setShowQuestion] = useState(false);

  // Arcade
  const [balance, setBalance] = useState(0);
  const [balanceLoaded, setBalanceLoaded] = useState(false);
  const [bet, setBet] = useState(1);
  const [highScore, setHighScore] = useState(0);

  // Sync casino balance on close (fire-and-forget).
  const handleClose = useCallback(async () => {
    if (isArcade) {
      try { await updateCasinoBalance(userId, balance); } catch { /* ok */ }
    }
    onClose();
  }, [isArcade, userId, balance, onClose]);

  const [error, setError] = useState('');

  // Load arcade balance from shared casino pool
  useEffect(() => {
    if (!isArcade) return;
    getCasinoBalance(userId).then(r => { setBalance(r.balance); setBalanceLoaded(true); }).catch(() => { setBalance(100); setBalanceLoaded(true); });
  }, [isArcade, userId]);

  // Gold accent
  const gold = '#ffd700';
  const darkBg = '#1a1a2e';
  const frameBg = '#2c2c44';

  // ── Spin handler ────────────────────────────────────────────────────
  const handleSpin = useCallback(async () => {
    if (spinning) return;
    if (isArcade && balance < bet) return;

    setSpinning(true);
    setShowWin(false);
    setWinText('');
    setShowConfetti(false);

    setError('');

    // Reset trivia state on new spin
    setQuestion(null);
    setSelectedAnswer(null);
    setAnswerCorrect(null);
    setShowQuestion(false);

    try {
      if (isArcade) {
        // Arcade: bet-based spin
        setBalance(prev => prev - bet);
        const result = await arcadeSlotSpin(userId, bet);
        const reels = result.reels.map((s: string) => SYMBOLS.indexOf(s) >= 0 ? SYMBOLS.indexOf(s) : 0);
        setReelTargets(reels);

        // Wait for reels to stop, then show result
        setTimeout(() => {
          setSpinning(false);
          if (result.payout > 0) {
            setBalance(prev => prev + result.payout);

            setShowWin(true);
            setWinText(`WIN $${result.payout.toFixed(2)}!`);
            if (result.payout > highScore) setHighScore(result.payout);
            if (result.matchType === 'jackpot') setShowConfetti(true);
          } else {
            setWinText('');
          }
        }, 3200);

      } else {
        // Trivia: multiplier + category spin
        const result = await spinSlotMachine(userId, isCatchingUp);
        const newTargets = [0, 1, 2].map(() => Math.floor(Math.random() * SYMBOLS.length));
        setReelTargets(newTargets);
        setTriviaMultiplier(result.multiplier);
        setTriviaCategory(result.category);

        // Wait for reels, then show multiplier/category, then auto-load question
        setTimeout(() => {
          setSpinning(false);
          setShowWin(true);
          setWinText(`${result.multiplier}× ${result.category}`);

          // Auto-load question after brief celebration
          setTimeout(async () => {
            try {
              const qResult = await getSlotMachineQuestion(userId);
              setQuestion(qResult.question);
              setShowQuestion(true);
            } catch (err) {
              logger.error('Failed to load question', err);
              setError('Failed to load question');
            }
          }, 1800);
        }, 3200);
      }
    } catch (err: any) {
      logger.error('Spin failed', err);
      setSpinning(false);
      setError(err.message || 'Spin failed');
    }
  }, [spinning, isArcade, balance, bet, userId, isCatchingUp, highScore]);

  // ── Answer handler ──────────────────────────────────────────────────
  const handleAnswer = useCallback(async (choice: string) => {
    if (selectedAnswer) return;
    setSelectedAnswer(choice);
    try {
      const result = await submitSlotMachineAnswer(userId, choice, groupId);
      setAnswerCorrect(result.correct);
      setAnswerPoints(result.pointsEarned);
      setCorrectAnswer(result.correctAnswer || '');
      if (result.correct) setShowConfetti(true);
      // Auto-close after delay
      setTimeout(() => {
        onComplete?.(result.pointsEarned);
      }, 2500);
    } catch (err) {
      logger.error('Answer failed', err);
    }
  }, [selectedAnswer, userId, groupId, onComplete]);

  // ── Bet helpers ─────────────────────────────────────────────────────
  const betUp = () => {
    const idx = BET_OPTIONS.indexOf(bet);
    if (idx < BET_OPTIONS.length - 1) setBet(BET_OPTIONS[idx + 1]);
  };
  const betDown = () => {
    const idx = BET_OPTIONS.indexOf(bet);
    if (idx > 0) setBet(BET_OPTIONS[idx - 1]);
  };
  const betMax = () => setBet(BET_OPTIONS[BET_OPTIONS.length - 1]);

  // Derive bust state (no effect needed — pure computation from state)
  const isBusted = isArcade && balanceLoaded && !spinning && balance <= 0;
  const canSpin = !spinning && !showQuestion && (!isArcade || balance >= bet) && !isBusted;

  // Trivia reel overlays (show multiplier + category after spin)
  const reelOverlays = !isArcade && !spinning && triviaMultiplier > 0
    ? [`${triviaMultiplier}×`, undefined, triviaCategory.length > 10 ? triviaCategory.slice(0, 9) + '…' : triviaCategory]
    : [undefined, undefined, undefined];

  return (
    <Box sx={{ maxWidth: 380, mx: 'auto' }}>
      <Box sx={{
        bgcolor: darkBg, borderRadius: 3,
        border: `3px solid ${gold}`,
        overflow: 'hidden',
        boxShadow: `0 10px 40px rgba(0,0,0,0.6), inset 0 1px 0 ${alpha(gold, 0.2)}`,
      }}>
        {/* ── Header ───────────────────────────────────────────────── */}
        <Box sx={{
          bgcolor: frameBg, py: 1.25, px: 2,
          borderBottom: `2px solid ${gold}`,
          display: 'flex', alignItems: 'center',
        }}>
          {/* Balance (arcade) or mode label */}
          <Box sx={{ flex: 1 }}>
            {isArcade ? (
              <Typography sx={{ fontSize: '0.75rem', color: alpha('#fff', 0.6) }}>
                CREDITS <Box component="span" sx={{ color: gold, fontWeight: 800, fontSize: '0.85rem' }}>${balance.toFixed(2)}</Box>
              </Typography>
            ) : (
              <Typography sx={{ fontSize: '0.65rem', color: alpha('#fff', 0.5), letterSpacing: 1 }}>
                TRIVIA MODE
              </Typography>
            )}
          </Box>

          {/* Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CasinoIcon sx={{ color: gold, fontSize: 20 }} />
            <Typography sx={{
              fontWeight: 900, color: gold, fontSize: '1rem', letterSpacing: 2,
            }}>
              SLOTS
            </Typography>
          </Box>

          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton size="small" onClick={handleClose} sx={{ color: alpha('#fff', 0.5), '&:hover': { color: '#fff' } }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* ── Reel Window ──────────────────────────────────────────── */}
        <Box sx={{
          bgcolor: '#0f0f1f', py: 2, px: 1.5,
          position: 'relative',
          // Metallic side frames
          borderLeft: `6px solid ${frameBg}`,
          borderRight: `6px solid ${frameBg}`,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
            {/* Reels */}
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                targetIndex={reelTargets[i]}
                spinning={spinning}
                stopDelay={2 + i * 0.6}
                overlayText={reelOverlays[i]}
              />
            ))}

            {/* Lever — right side of reels */}
            <Box
              onPointerDown={canSpin ? handleSpin : undefined}
              sx={{
                width: 36, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'flex-start',
                cursor: canSpin ? 'pointer' : 'default',
                opacity: canSpin ? 1 : 0.4,
                ml: 0.5, pt: 0.5,
              }}
            >
              {/* Ball handle */}
              <Box sx={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #ff6666, #cc0000, #880000)',
                border: '2px solid #990000',
                boxShadow: '0 2px 8px rgba(0,0,0,0.5), inset 0 2px 3px rgba(255,255,255,0.25)',
                zIndex: 2,
                animation: spinning ? `${leverPull} 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)` : 'none',
              }} />
              {/* Chrome shaft */}
              <Box sx={{
                width: 8, height: 140, mt: -1,
                background: 'linear-gradient(90deg, #888, #ddd 30%, #fff 50%, #ddd 70%, #888)',
                borderRadius: 1,
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }} />
              {/* Base */}
              <Box sx={{
                width: 28, height: 10,
                background: 'linear-gradient(180deg, #bbb, #666)',
                borderRadius: '2px 2px 4px 4px',
                border: '1px solid #555',
              }} />
            </Box>
          </Box>

          {/* Payline indicator */}
          <Box sx={{
            position: 'absolute', top: '50%', left: 8, right: 8,
            transform: 'translateY(-50%)', height: 3,
            bgcolor: gold,
            opacity: showWin ? 1 : 0.25,
            boxShadow: showWin ? `0 0 15px ${gold}` : 'none',
            animation: showWin ? `${winFlash} 1s infinite` : 'none',
            transition: 'opacity 0.3s',
            borderRadius: 2,
          }} />

          {/* Payline arrows */}
          {['left', 'right'].map(side => (
            <Box key={side} sx={{
              position: 'absolute', top: '50%',
              [side]: -2, transform: 'translateY(-50%)',
              width: 0, height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              [side === 'left' ? 'borderLeft' : 'borderRight']: `8px solid ${gold}`,
              opacity: 0.6,
            }} />
          ))}

          {/* Confetti */}
          {showConfetti && (
            <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 10 }}>
              {CONFETTI.map((p, i) => (
                <Box key={i} sx={{
                  position: 'absolute', top: -10, left: p.left,
                  width: p.size, height: p.size,
                  bgcolor: p.color, borderRadius: '1px',
                  animation: `${confettiDrop} 1.2s ease-out ${p.delay} forwards`,
                }} />
              ))}
            </Box>
          )}
        </Box>

        {/* ── Win Display ──────────────────────────────────────────── */}
        <Box sx={{
          height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: alpha('#000', 0.3),
          borderTop: `1px solid ${alpha(gold, 0.15)}`,
          borderBottom: `1px solid ${alpha(gold, 0.15)}`,
        }}>
          {winText ? (
            <Typography sx={{
              color: gold, fontWeight: 900, fontSize: '1.1rem',
              animation: showWin ? `${glow} 1.5s infinite` : 'none',
              letterSpacing: 1,
            }}>
              {winText}
            </Typography>
          ) : spinning ? (
            <LoadingDots size={4} color={alpha('#fff', 0.3)} mt={0} />
          ) : (
            <Typography sx={{ color: alpha('#fff', 0.2), fontSize: '0.7rem', letterSpacing: 2 }}>
              {isArcade ? 'PLACE YOUR BET' : 'SPIN TO PLAY'}
            </Typography>
          )}
        </Box>

        {/* ── Info Strip (credits + bet + win) ──────────────────── */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between',
          px: 2, py: 0.75,
          bgcolor: '#111',
          borderTop: `1px solid ${alpha(gold, 0.15)}`,
          borderBottom: `1px solid ${alpha(gold, 0.15)}`,
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.45rem', color: alpha('#fff', 0.4), letterSpacing: 1.5 }}>CREDITS</Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: gold }}>
              {isArcade ? balance.toFixed(2) : '---'}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.45rem', color: alpha('#fff', 0.4), letterSpacing: 1.5 }}>BET</Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: '#fff' }}>
              ${bet < 1 ? bet.toFixed(2) : bet}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.45rem', color: alpha('#fff', 0.4), letterSpacing: 1.5 }}>WIN</Typography>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 800, color: showWin ? gold : alpha('#fff', 0.2) }}>
              {showWin && winText ? winText.replace('WIN ', '') : '---'}
            </Typography>
          </Box>
        </Box>

        {/* ── Control Panel — Physical casino buttons ──────────────── */}
        <Box sx={{
          background: 'linear-gradient(180deg, #3a3a4e, #2c2c3e, #222234)',
          px: 1.5, py: 1.5,
          pb: 'calc(12px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid #555',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}>
          {/* Button row — chunky physical buttons on a shelf */}
          <Box sx={{
            display: 'flex', alignItems: 'stretch', justifyContent: 'center',
            gap: 0.75,
          }}>
            {/* BET LESS — physical button */}
            {[
              { label: 'BET', sublabel: 'LESS', onClick: betDown, color: '#2196f3', disabled: !isArcade },
              { label: 'BET', sublabel: 'MORE', onClick: betUp, color: '#4caf50', disabled: !isArcade },
              { label: 'MAX', sublabel: 'BET', onClick: betMax, color: gold, disabled: !isArcade },
            ].map(btn => (
              <Box
                key={btn.sublabel}
                onClick={!btn.disabled && !spinning ? btn.onClick : undefined}
                sx={{
                  flex: 1, maxWidth: 65,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  py: 1, px: 0.5,
                  borderRadius: '8px',
                  cursor: btn.disabled || spinning ? 'default' : 'pointer',
                  userSelect: 'none',
                  // 3D physical button look
                  bgcolor: btn.disabled ? '#2a2a3a' : '#333345',
                  border: `2px solid ${btn.disabled ? '#3a3a4a' : alpha(btn.color, 0.5)}`,
                  borderBottom: `4px solid ${btn.disabled ? '#222' : alpha(btn.color, 0.3)}`,
                  boxShadow: btn.disabled
                    ? 'none'
                    : `0 3px 8px rgba(0,0,0,0.4), inset 0 1px 0 ${alpha('#fff', 0.08)}`,
                  opacity: btn.disabled ? 0.4 : 1,
                  transition: 'all 0.1s',
                  '&:active': !btn.disabled && !spinning ? {
                    transform: 'translateY(2px)',
                    borderBottomWidth: '2px',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
                  } : {},
                }}
              >
                <Typography sx={{
                  fontSize: '0.5rem', fontWeight: 700, letterSpacing: 1,
                  color: btn.disabled ? '#555' : alpha(btn.color, 0.9),
                }}>
                  {btn.label}
                </Typography>
                <Typography sx={{
                  fontSize: '0.55rem', fontWeight: 900, letterSpacing: 1.5,
                  color: btn.disabled ? '#444' : '#fff',
                }}>
                  {btn.sublabel}
                </Typography>
              </Box>
            ))}

            {/* SPIN — largest, most prominent button */}
            <Box
              onClick={canSpin ? handleSpin : undefined}
              sx={{
                flex: 1.5, maxWidth: 90,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                py: 1.25,
                borderRadius: '10px',
                cursor: canSpin ? 'pointer' : 'default',
                userSelect: 'none',
                bgcolor: canSpin ? '#1b5e20' : '#2a2a3a',
                border: `2px solid ${canSpin ? '#4caf50' : '#3a3a4a'}`,
                borderBottom: `5px solid ${canSpin ? '#2e7d32' : '#222'}`,
                boxShadow: canSpin
                  ? `0 4px 12px rgba(76,175,80,0.4), inset 0 1px 0 ${alpha('#fff', 0.1)}`
                  : 'none',
                transition: 'all 0.1s',
                '&:active': canSpin ? {
                  transform: 'translateY(3px)',
                  borderBottomWidth: '2px',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.6)',
                } : {},
              }}
            >
              <Typography sx={{
                fontSize: '0.95rem', fontWeight: 900, letterSpacing: 3,
                color: canSpin ? '#fff' : '#555',
                textShadow: canSpin ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
              }}>
                {spinning ? '•••' : 'SPIN'}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Payout strip ─────────────────────────────────────────── */}
        <Box sx={{
          display: 'flex', justifyContent: 'center', gap: 0.75,
          py: 0.5, px: 1,
          bgcolor: alpha('#000', 0.4),
          borderTop: `1px solid ${alpha(gold, 0.08)}`,
          flexWrap: 'wrap',
        }}>
          {Object.entries(PAYOUT_TABLE).map(([sym, mult]) => (
            <Typography key={sym} sx={{ fontSize: '0.5rem', color: alpha('#fff', 0.3) }}>
              {sym}{mult}×
            </Typography>
          ))}
        </Box>

        {/* ── Error ────────────────────────────────────────────────── */}
        {error && (
          <Box sx={{ px: 2, py: 1, bgcolor: alpha('#f44336', 0.1) }}>
            <Typography sx={{ fontSize: '0.72rem', color: '#f44336', textAlign: 'center' }}>{error}</Typography>
          </Box>
        )}

        {/* ── Busted overlay (arcade) ──────────────────────────────── */}
        {isBusted && (
          <Box sx={{
            position: 'absolute', inset: 0, zIndex: 20,
            bgcolor: alpha('#000', 0.85),
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            animation: `${fadeUp} 0.4s ease-out`,
          }}>
            <Typography sx={{ fontSize: '2rem', fontWeight: 900, color: '#f44336', mb: 1 }}>
              BUSTED
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: alpha('#fff', 0.6), mb: 0.5 }}>
              Best payout: ${highScore.toFixed(2)}
            </Typography>
            <Button variant="contained" onClick={handleClose} sx={{
              mt: 2, bgcolor: gold, color: '#000', fontWeight: 700,
              '&:hover': { bgcolor: '#ffeb3b' },
            }}>
              Back to Arcade
            </Button>
          </Box>
        )}
      </Box>

      {/* ── Question overlay (trivia mode) ─────────────────────────── */}
      {showQuestion && question && (
        <Box sx={{
          mt: -1, borderRadius: '0 0 12px 12px',
          bgcolor: '#fff',
          border: `2px solid ${alpha(gold, 0.3)}`,
          borderTop: 'none',
          overflow: 'hidden',
          animation: `${fadeUp} 0.3s ease-out`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        }}>
          {/* Category + multiplier header */}
          <Box sx={{
            px: 2, py: 1,
            bgcolor: alpha(theme.palette.primary.main, 0.06),
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: theme.palette.text.secondary }}>
              {triviaCategory}
            </Typography>
            <Box sx={{
              px: 1, py: 0.25, borderRadius: 1,
              bgcolor: alpha(gold, 0.15), color: '#b8860b',
              fontWeight: 800, fontSize: '0.7rem',
            }}>
              {triviaMultiplier}×
            </Box>
          </Box>

          {/* Question */}
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: '0.88rem', fontWeight: 500, mb: 1.5, lineHeight: 1.5 }}>
              {question.question}
            </Typography>

            {/* Choices */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {question.choices.map((choice: string) => {
                const isSelected = selectedAnswer === choice;
                const isCorrect = answerCorrect !== null && correctAnswer === choice;
                const isWrong = answerCorrect !== null && isSelected && !answerCorrect;

                return (
                  <Button
                    key={choice}
                    fullWidth
                    variant="outlined"
                    disabled={selectedAnswer !== null}
                    onClick={() => handleAnswer(choice)}
                    startIcon={isCorrect ? <CheckCircleIcon /> : isWrong ? <CancelIcon /> : undefined}
                    sx={{
                      justifyContent: 'flex-start', textAlign: 'left',
                      textTransform: 'none', fontSize: '0.82rem', py: 1, px: 1.5,
                      borderRadius: 2,
                      borderColor: isCorrect ? theme.palette.success.main
                        : isWrong ? theme.palette.error.main
                        : alpha(theme.palette.primary.main, 0.3),
                      bgcolor: isCorrect ? alpha(theme.palette.success.main, 0.1)
                        : isWrong ? alpha(theme.palette.error.main, 0.08)
                        : isSelected ? alpha(theme.palette.primary.main, 0.05)
                        : '#fff',
                      borderWidth: isCorrect || isWrong ? 2 : 1,
                      '&.Mui-disabled': {
                        color: isCorrect ? theme.palette.success.dark
                          : isWrong ? theme.palette.error.dark
                          : alpha(theme.palette.text.primary, 0.5),
                      },
                    }}
                  >
                    {choice}
                  </Button>
                );
              })}
            </Box>

            {/* Answer result */}
            {answerCorrect !== null && (
              <Box sx={{
                mt: 1.5, py: 1, textAlign: 'center', borderRadius: 2,
                bgcolor: answerCorrect
                  ? alpha(theme.palette.success.main, 0.08)
                  : alpha(theme.palette.error.main, 0.06),
              }}>
                <Typography sx={{
                  fontWeight: 800, fontSize: '0.9rem',
                  color: answerCorrect ? theme.palette.success.dark : theme.palette.error.dark,
                }}>
                  {answerCorrect ? `+${answerPoints} points!` : 'Not this time'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default SlotMachine;
