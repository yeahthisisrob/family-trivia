/**
 * BlackjackGame — arcade blackjack with full casino flair.
 *
 * Uses your season score as starting credits (same balance as slots).
 * Score = peak profit in a session, submitted to the arcade leaderboard.
 * Visual language matches the slot machine: dark navy, gold accents,
 * metallic framing, animated card deals, result glow/shake effects.
 */

import CasinoIcon from '@mui/icons-material/Casino';
import CloseIcon from '@mui/icons-material/Close';
import StyleIcon from '@mui/icons-material/Style';
import {
  Box, Button, IconButton, Typography, keyframes,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { getCasinoBalance, updateCasinoBalance } from '../../api/modules/casino';
import { getBlackjackTaunt } from '../../api/modules/gameAI';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('BlackjackGame');

// ── Theme (matches SlotMachine) ─────────────────────────────────

const gold = '#ffd700';
const darkBg = '#1a1a2e';
const frameBg = '#2c2c44';
const feltGreen = '#0d5930';
const feltGradient = `radial-gradient(ellipse at 50% 40%, #0f6b38, ${feltGreen} 60%, #0a4a26)`;

// ── Card types ──────────────────────────────────────────────────

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';
interface Card { suit: Suit; rank: Rank; faceDown?: boolean; }

const SUIT_SYM: Record<Suit, string> = { hearts: '\u2665', diamonds: '\u2666', clubs: '\u2663', spades: '\u2660' };
const SUIT_CLR: Record<Suit, string> = { hearts: '#ef5350', diamonds: '#ef5350', clubs: '#263238', spades: '#263238' };

function handTotal(hand: Card[]): number {
  let total = 0, aces = 0;
  for (const c of hand) {
    if (c.faceDown) continue;
    if (c.rank === 'A') { aces++; total += 11; }
    else if ('JQK'.includes(c.rank)) total += 10;
    else total += parseInt(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function buildDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const deck: Card[] = [];
  for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ── Animations ──────────────────────────────────────────────────

const dealCard = keyframes`
  from { opacity: 0; transform: translateX(60px) rotateY(80deg) scale(0.6); }
  50%  { opacity: 1; transform: translateX(-6px) rotateY(-8deg) scale(1.04); }
  to   { opacity: 1; transform: translateX(0) rotateY(0) scale(1); }
`;

const flipCard = keyframes`
  0%   { transform: rotateY(0deg); }
  50%  { transform: rotateY(90deg); }
  100% { transform: rotateY(0deg); }
`;

const winPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.6); transform: scale(1); }
  50%  { box-shadow: 0 0 30px 10px rgba(255, 215, 0, 0.2); transform: scale(1.02); }
  100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); transform: scale(1); }
`;

const loseShake = keyframes`
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-5px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(2px); }
`;

const balanceBump = keyframes`
  0%   { transform: scale(1); }
  30%  { transform: scale(1.4); }
  100% { transform: scale(1); }
`;

const glowText = keyframes`
  0%, 100% { text-shadow: 0 0 8px ${gold}; }
  50%      { text-shadow: 0 0 24px ${gold}, 0 0 48px ${alpha(gold, 0.5)}; }
`;

const chipPop = keyframes`
  0%   { transform: scale(1); }
  50%  { transform: scale(0.88); }
  100% { transform: scale(1); }
`;

function vibrate(ms = 10) {
  try { navigator?.vibrate?.(ms); } catch { /* ok */ }
}

const BET_OPTIONS = [1, 5, 10, 25];

// ── Component ───────────────────────────────────────────────────

type GamePhase = 'loading' | 'betting' | 'playing' | 'dealerTurn' | 'result';

interface BlackjackGameProps { userId: string; onClose: () => void; }

const BlackjackGame: React.FC<BlackjackGameProps> = ({ userId, onClose }) => {
  const [phase, setPhase] = useState<GamePhase>('loading');
  const [balance, setBalance] = useState(0);
  const [bet, setBet] = useState(5);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [resultMsg, setResultMsg] = useState('');
  const [resultDelta, setResultDelta] = useState(0);
  const [handsPlayed, setHandsPlayed] = useState(0);
  const [handsWon, setHandsWon] = useState(0);
  const [floorVal, setFloorVal] = useState(0);
  const [balanceAnim, setBalanceAnim] = useState(false);
  const [dealerTaunt, setDealerTaunt] = useState('');
  const deckRef = useRef<Card[]>([]);

  // ── Load shared casino balance ────────────────────────────────
  useEffect(() => {
    getCasinoBalance(userId)
      .then(r => { setBalance(r.balance); setFloorVal(r.floor); deckRef.current = buildDeck(); setPhase('betting'); })
      .catch(() => { setBalance(10); deckRef.current = buildDeck(); setPhase('betting'); });
  }, [userId]);

  const draw = useCallback((faceDown = false): Card => {
    if (deckRef.current.length < 10) deckRef.current = buildDeck();
    return { ...deckRef.current.pop()!, faceDown };
  }, []);

  const trackPeak = useCallback((_nb: number) => {
    // Balance is tracked in state; peak doesn't need separate tracking
    // since the leaderboard score = current balance (shared pool).
  }, []);

  const animateBalance = useCallback(() => {
    setBalanceAnim(true);
    setTimeout(() => setBalanceAnim(false), 500);
  }, []);

  // ── Deal ──────────────────────────────────────────────────────
  const deal = useCallback(() => {
    if (balance < bet) { setBet(Math.max(1, ...BET_OPTIONS.filter(b => b <= balance))); return; }
    vibrate();
    const p1 = draw(), d1 = draw(), p2 = draw(), d2 = draw(true);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setBalance(b => b - bet);
    setHandsPlayed(h => h + 1);
    setResultMsg('');
    setResultDelta(0);

    if (handTotal([p1, p2]) === 21) {
      d2.faceDown = false;
      setDealerHand([d1, d2]);
      if (handTotal([d1, d2]) === 21) {
        setResultMsg('Push!'); setResultDelta(0);
        setBalance(b => { const nb = b + bet; trackPeak(nb); animateBalance(); return nb; });
      } else {
        const win = Math.floor(bet * 1.5);
        setResultMsg(`BLACKJACK! +${bet + win}`); setResultDelta(bet + win);
        setBalance(b => { const nb = b + bet + win; trackPeak(nb); animateBalance(); return nb; });
        setHandsWon(w => w + 1);
        vibrate(30);
      }
      setPhase('result');
      return;
    }
    setPhase('playing');
  }, [balance, bet, draw, trackPeak, animateBalance]);

  // ── Hit ───────────────────────────────────────────────────────
  const hit = useCallback(() => {
    vibrate();
    const card = draw();
    setPlayerHand(prev => {
      const nh = [...prev, card];
      if (handTotal(nh) > 21) {
        setResultMsg('BUST!'); setResultDelta(-bet);
        setDealerHand(dh => dh.map(c => ({ ...c, faceDown: false })));
        setPhase('result'); vibrate(40);
      }
      return nh;
    });
  }, [draw, bet]);

  // ── Stand ─────────────────────────────────────────────────────
  const stand = useCallback(() => {
    vibrate();
    setPhase('dealerTurn');
    setDealerHand(dh => dh.map(c => ({ ...c, faceDown: false })));
  }, []);

  // ── Dealer auto-draw ──────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'dealerTurn') return;
    const dt = handTotal(dealerHand);

    if (dt < 17) {
      const t = setTimeout(() => { vibrate(5); setDealerHand(prev => [...prev, draw()]); }, 600);
      return () => clearTimeout(t);
    }

    const pt = handTotal(playerHand);
    let msg = '', delta = 0;
    if (dt > 21)       { msg = `Dealer busts! +${bet * 2}`; delta = bet * 2; setHandsWon(w => w + 1); }
    else if (pt > dt)  { msg = `You win! +${bet * 2}`; delta = bet * 2; setHandsWon(w => w + 1); }
    else if (pt === dt) { msg = 'Push — tie!'; delta = bet; }
    else               { msg = 'Dealer wins.'; delta = 0; }

    setResultMsg(msg); setResultDelta(delta);
    setBalance(b => { const nb = b + delta; trackPeak(nb); animateBalance(); return nb; });
    if (delta > bet) vibrate(25);
    else if (delta === 0) vibrate(40);
    setPhase('result');
  }, [phase, dealerHand, playerHand, bet, draw, trackPeak, animateBalance]);

  // ── Double down ───────────────────────────────────────────────
  const doubleDown = useCallback(() => {
    vibrate();
    setBalance(b => b - bet);
    const card = draw();
    setPlayerHand(prev => {
      const nh = [...prev, card];
      if (handTotal(nh) > 21) {
        setResultMsg('BUST!'); setResultDelta(-(bet * 2));
        setDealerHand(dh => dh.map(c => ({ ...c, faceDown: false })));
        setPhase('result'); vibrate(40);
      } else {
        setBet(b => b * 2);
        setPhase('dealerTurn');
        setDealerHand(dh => dh.map(c => ({ ...c, faceDown: false })));
      }
      return nh;
    });
  }, [draw, bet]);

  // ── Dealer taunt (Haiku-powered, fire-and-forget) ───────────────
  const fetchTaunt = useCallback((bjPhase: 'deal' | 'hit' | 'stand' | 'bust' | 'win' | 'push') => {
    const pCards = playerHand.filter(c => !c.faceDown).map(c => `${c.rank}${SUIT_SYM[c.suit]}`);
    const dShow = dealerHand.find(c => !c.faceDown);
    getBlackjackTaunt({
      playerHand: pCards,
      dealerShowing: dShow ? `${dShow.rank}${SUIT_SYM[dShow.suit]}` : '?',
      playerTotal: handTotal(playerHand),
      phase: bjPhase,
    }).then(res => {
      if (res?.taunt) setDealerTaunt(res.taunt);
    }).catch(() => {});
  }, [playerHand, dealerHand]);

  // Fetch taunt on result
  useEffect(() => {
    if (phase === 'result' && resultMsg) {
      const bjPhase = resultMsg.includes('BUST') ? 'bust'
        : resultMsg.includes('win') || resultMsg.includes('busts') ? 'win'
          : resultMsg.includes('Push') ? 'push'
            : resultMsg.includes('BLACKJACK') ? 'win'
              : resultMsg.includes('Dealer wins') ? 'bust'
                : 'deal';
      fetchTaunt(bjPhase);
    } else if (phase === 'playing') {
      setDealerTaunt('');
    }
  }, [phase, resultMsg, fetchTaunt]);

  // ── End session — sync balance back to shared pool ─────────────
  const endSession = useCallback(async () => {
    try { await updateCasinoBalance(userId, balance); }
    catch (err) { logger.error('Failed to sync casino balance', err); }
    onClose();
  }, [userId, balance, onClose]);

  // ── Card component ────────────────────────────────────────────
  const CardEl = ({ card, delay = 0 }: { card: Card; delay?: number }) => {
    if (card.faceDown) {
      return (
        <Box sx={{
          width: 56, height: 80, borderRadius: `${radii.md}px`, flexShrink: 0,
          background: `repeating-linear-gradient(135deg, ${frameBg}, ${frameBg} 3px, ${darkBg} 3px, ${darkBg} 6px)`,
          border: `2px solid ${alpha(gold, 0.3)}`,
          boxShadow: `0 3px 10px ${alpha('#000', 0.5)}`,
          animation: `${dealCard} 0.35s ${delay}ms ease-out both`,
        }} />
      );
    }
    const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
    return (
      <Box sx={{
        width: 56, height: 80, borderRadius: `${radii.md}px`, flexShrink: 0,
        bgcolor: '#fafafa',
        border: `2px solid ${alpha('#000', 0.12)}`,
        boxShadow: `0 3px 10px ${alpha('#000', 0.3)}`,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 0,
        animation: `${dealCard} 0.35s ${delay}ms ease-out both`,
        position: 'relative',
      }}>
        <Typography sx={{ fontSize: '1.15rem', fontWeight: 900, lineHeight: 1, color: SUIT_CLR[card.suit] }}>
          {card.rank}
        </Typography>
        <Typography sx={{ fontSize: '1rem', lineHeight: 1, color: SUIT_CLR[card.suit], mt: -0.25 }}>
          {SUIT_SYM[card.suit]}
        </Typography>
        {/* Corner pip */}
        <Box sx={{
          position: 'absolute', top: 3, left: 4,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <Typography sx={{ fontSize: '0.45rem', fontWeight: 800, lineHeight: 1, color: SUIT_CLR[card.suit] }}>{card.rank}</Typography>
          <Typography sx={{ fontSize: '0.45rem', lineHeight: 1, color: SUIT_CLR[card.suit] }}>{SUIT_SYM[card.suit]}</Typography>
        </Box>
      </Box>
    );
  };

  const HandRow = ({ hand, label, total, showTotal }: { hand: Card[]; label: string; total: number; showTotal: boolean }) => (
    <Box sx={{ mb: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, color: alpha('#fff', 0.55), textTransform: 'uppercase', letterSpacing: 1.5 }}>
          {label}
        </Typography>
        {showTotal && (
          <Box sx={{
            px: 0.75, py: 0.1, borderRadius: 1, minWidth: 22, textAlign: 'center',
            bgcolor: total === 21 ? gold : total > 21 ? '#ef5350' : alpha('#fff', 0.15),
            color: total === 21 ? darkBg : '#fff',
            fontSize: '0.7rem', fontWeight: 900,
            ...(total === 21 && { animation: `${glowText} 1.5s ease-in-out infinite` }),
          }}>
            {total}
          </Box>
        )}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        {hand.map((c, i) => <CardEl key={i} card={c} delay={i * 120} />)}
      </Box>
    </Box>
  );

  const isBusted = balance <= 0 && phase === 'betting';
  const canDouble = phase === 'playing' && playerHand.length === 2 && balance >= bet;
  const isWin = resultDelta > 0;
  const isLoss = resultDelta === 0 && resultMsg.includes('wins') || resultMsg.includes('BUST');
  const isBlackjack = resultMsg.includes('BLACKJACK');

  // ── Render ────────────────────────────────────────────────────
  return (
    <Box sx={{
      maxWidth: 400, mx: 'auto', width: '100%',
      userSelect: 'none', touchAction: 'none',
    }}>
      {/* Casino frame — matches slot machine chrome */}
      <Box sx={{
        bgcolor: darkBg, borderRadius: 3,
        border: `3px solid ${gold}`,
        overflow: 'hidden',
        boxShadow: `0 10px 40px rgba(0,0,0,0.6), inset 0 1px 0 ${alpha(gold, 0.2)}`,
      }}>
        {/* ── Header ─────────────────────────────────────────────── */}
        <Box sx={{
          bgcolor: frameBg, py: 1, px: 2,
          borderBottom: `2px solid ${gold}`,
          display: 'flex', alignItems: 'center',
        }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', color: alpha('#fff', 0.55) }}>
              CREDITS{' '}
              <Box component="span" sx={{
                color: gold, fontWeight: 900, fontSize: '0.85rem',
                display: 'inline-block',
                animation: balanceAnim ? `${balanceBump} 0.4s ease-out` : 'none',
              }}>
                {balance}
              </Box>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <StyleIcon sx={{ color: gold, fontSize: 18 }} />
            <Typography sx={{ fontWeight: 900, color: gold, fontSize: '0.95rem', letterSpacing: 2 }}>
              BLACKJACK
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton size="small" onClick={endSession} sx={{ color: alpha('#fff', 0.4), '&:hover': { color: '#fff' } }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* ── Felt table ─────────────────────────────────────────── */}
        <Box sx={{
          background: feltGradient,
          px: 2, py: 2,
          minHeight: 320,
          display: 'flex', flexDirection: 'column',
          borderLeft: `6px solid ${frameBg}`,
          borderRight: `6px solid ${frameBg}`,
          position: 'relative',
        }}>
          {phase === 'loading' && (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingDots />
            </Box>
          )}

          {/* ── Betting ──────────────────────────────────────────── */}
          {(phase === 'betting') && !isBusted && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2.5 }}>
              <Typography sx={{
                fontSize: '0.7rem', color: alpha('#fff', 0.5),
                textTransform: 'uppercase', letterSpacing: 2, fontWeight: 700,
              }}>
                Place your bet
              </Typography>

              {/* Chips */}
              <Box sx={{ display: 'flex', gap: 1.25 }}>
                {BET_OPTIONS.filter(b => b <= balance).map(b => {
                  const active = bet === b;
                  return (
                    <Box key={b}
                      onClick={() => { setBet(b); vibrate(); }}
                      sx={{
                        width: 54, height: 54, borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: active
                          ? `radial-gradient(circle at 35% 35%, #ffe066, ${gold}, #c9a400)`
                          : `radial-gradient(circle at 35% 35%, #555, #333, #222)`,
                        color: active ? darkBg : alpha('#fff', 0.7),
                        fontWeight: 900, fontSize: '0.95rem',
                        border: `3px solid ${active ? '#fff' : alpha('#fff', 0.15)}`,
                        boxShadow: active
                          ? `0 0 12px ${alpha(gold, 0.6)}, inset 0 1px 0 ${alpha('#fff', 0.4)}`
                          : `0 2px 6px ${alpha('#000', 0.4)}, inset 0 1px 0 ${alpha('#fff', 0.08)}`,
                        cursor: 'pointer',
                        transition: 'all 0.12s',
                        animation: active ? `${chipPop} 0.2s ease-out` : 'none',
                        '&:hover': { borderColor: gold },
                      }}
                    >
                      {b}
                    </Box>
                  );
                })}
              </Box>

              <Button onClick={deal} sx={{
                bgcolor: gold, color: darkBg,
                fontWeight: 900, px: 4, py: 1.25,
                borderRadius: `${radii.md}px`,
                fontSize: '0.95rem', textTransform: 'none',
                boxShadow: `0 4px 16px ${alpha(gold, 0.4)}`,
                '&:hover': { bgcolor: '#ffca28', boxShadow: `0 4px 20px ${alpha(gold, 0.6)}` },
              }}>
                Deal — {bet} credits
              </Button>

              {handsPlayed > 0 && (
                <Typography sx={{ fontSize: '0.68rem', color: alpha('#fff', 0.35) }}>
                  {handsPlayed} hands · {handsWon} won
                </Typography>
              )}
            </Box>
          )}

          {/* ── Busted ───────────────────────────────────────────── */}
          {isBusted && (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Typography sx={{ fontSize: '1.3rem', fontWeight: 900, color: '#ef5350' }}>
                Out of credits!
              </Typography>
              <Typography sx={{ fontSize: '0.78rem', color: alpha('#fff', 0.5), textAlign: 'center' }}>
                {handsPlayed} hands · {handsWon} won
              </Typography>
              <Button onClick={endSession} sx={{
                bgcolor: gold, color: darkBg, fontWeight: 900,
                textTransform: 'none', borderRadius: `${radii.md}px`, px: 3,
                '&:hover': { bgcolor: '#ffca28' },
              }}>
                Back to Arcade
              </Button>
            </Box>
          )}

          {/* ── Active game ──────────────────────────────────────── */}
          {(phase === 'playing' || phase === 'dealerTurn' || phase === 'result') && (
            <Box sx={{
              flex: 1, display: 'flex', flexDirection: 'column',
              ...(phase === 'result' && {
                animation: isWin
                  ? `${winPulse} 0.8s ease-out`
                  : isLoss
                    ? `${loseShake} 0.4s ease-out`
                    : 'none',
              }),
            }}>
              <HandRow hand={dealerHand} label="Dealer" total={handTotal(dealerHand)} showTotal={!dealerHand.some(c => c.faceDown)} />
              <HandRow hand={playerHand} label="You" total={handTotal(playerHand)} showTotal />

              {/* Result banner */}
              {phase === 'result' && (
                <Box sx={{
                  textAlign: 'center', py: 1.25, mb: 1,
                  borderRadius: `${radii.md}px`,
                  bgcolor: isWin ? alpha(gold, 0.15) : isLoss ? alpha('#ef5350', 0.15) : alpha('#fff', 0.06),
                  border: `2px solid ${isWin ? alpha(gold, 0.5) : isLoss ? alpha('#ef5350', 0.4) : alpha('#fff', 0.12)}`,
                  ...(isBlackjack && {
                    border: `2px solid ${gold}`,
                    boxShadow: `0 0 20px ${alpha(gold, 0.3)}`,
                  }),
                }}>
                  <Typography sx={{
                    fontWeight: 900, fontSize: isBlackjack ? '1.2rem' : '1rem',
                    color: isWin ? gold : isLoss ? '#ef5350' : '#fff',
                    letterSpacing: isBlackjack ? 2 : 0,
                    ...(isBlackjack && { animation: `${glowText} 1.5s ease-in-out infinite` }),
                  }}>
                    {resultMsg}
                  </Typography>
                  {dealerTaunt && (
                    <Typography sx={{
                      fontSize: '0.72rem', fontStyle: 'italic',
                      color: alpha('#fff', 0.6), mt: 0.5,
                    }}>
                      &ldquo;{dealerTaunt}&rdquo;
                    </Typography>
                  )}
                </Box>
              )}

              {/* Action buttons */}
              <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center', mt: 'auto', pt: 1 }}>
                {phase === 'playing' && (
                  <>
                    <Button onClick={hit} sx={{
                      bgcolor: gold, color: darkBg, fontWeight: 900,
                      flex: 1, py: 1.25, borderRadius: `${radii.md}px`,
                      textTransform: 'none', fontSize: '0.95rem',
                      boxShadow: `0 3px 10px ${alpha(gold, 0.3)}`,
                      '&:hover': { bgcolor: '#ffca28' },
                    }}>
                      Hit
                    </Button>
                    <Button onClick={stand} sx={{
                      bgcolor: alpha('#fff', 0.1), color: '#fff', fontWeight: 900,
                      flex: 1, py: 1.25, borderRadius: `${radii.md}px`,
                      textTransform: 'none', fontSize: '0.95rem',
                      border: `1px solid ${alpha('#fff', 0.15)}`,
                      '&:hover': { bgcolor: alpha('#fff', 0.18) },
                    }}>
                      Stand
                    </Button>
                    {canDouble && (
                      <Button onClick={doubleDown} sx={{
                        bgcolor: alpha('#e040fb', 0.15), color: '#e040fb', fontWeight: 900,
                        flex: 1, py: 1.25, borderRadius: `${radii.md}px`,
                        textTransform: 'none', fontSize: '0.95rem',
                        border: `1px solid ${alpha('#e040fb', 0.3)}`,
                        '&:hover': { bgcolor: alpha('#e040fb', 0.25) },
                      }}>
                        2x
                      </Button>
                    )}
                  </>
                )}
                {phase === 'dealerTurn' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
                    <CasinoIcon sx={{ color: alpha('#fff', 0.4), fontSize: 18 }} />
                    <Typography sx={{ color: alpha('#fff', 0.5), fontSize: '0.85rem', fontWeight: 600 }}>
                      Dealer drawing...
                    </Typography>
                  </Box>
                )}
                {phase === 'result' && (
                  <Button onClick={() => setPhase('betting')} fullWidth sx={{
                    bgcolor: gold, color: darkBg, fontWeight: 900,
                    py: 1.25, borderRadius: `${radii.md}px`,
                    textTransform: 'none', fontSize: '0.95rem',
                    boxShadow: `0 3px 10px ${alpha(gold, 0.3)}`,
                    '&:hover': { bgcolor: '#ffca28' },
                  }}>
                    {balance > 0 ? 'Next Hand' : 'View Results'}
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Box>

        {/* ── Footer — current bet + stats ───────────────────────── */}
        <Box sx={{
          bgcolor: alpha('#000', 0.3),
          borderTop: `1px solid ${alpha(gold, 0.15)}`,
          px: 2, py: 0.75,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <Typography sx={{ fontSize: '0.65rem', color: alpha('#fff', 0.4) }}>
            BET: <Box component="span" sx={{ color: gold, fontWeight: 800 }}>{bet}</Box>
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: alpha('#fff', 0.4) }}>
            WON: <Box component="span" sx={{ color: gold, fontWeight: 800 }}>{handsWon}</Box>/{handsPlayed}
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: alpha('#fff', 0.4) }}>
            FLOOR: <Box component="span" sx={{ color: gold, fontWeight: 800 }}>{floorVal}</Box>
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default BlackjackGame;
