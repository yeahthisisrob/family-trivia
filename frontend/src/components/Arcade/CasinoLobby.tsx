/**
 * CasinoLobby — shared entry point for casino games (slots + blackjack).
 *
 * Shows the shared credit balance at the top, game tiles to pick from,
 * and a unified "Casino" leaderboard below. When a game is active, the
 * lobby hides and the game fills the view. On close, balance is synced
 * back to the shared pool.
 */

import CasinoIcon from '@mui/icons-material/Casino';
import CloseIcon from '@mui/icons-material/Close';
import FiberSmartRecordIcon from '@mui/icons-material/FiberSmartRecord';
import StyleIcon from '@mui/icons-material/Style';
import {
  Box, Button, Card, IconButton, Typography, useTheme,
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';

import ArcadeLeaderboard from './ArcadeLeaderboard';
import { getArcadeLeaderboard } from '../../api/modules/arcade';
import { getCasinoBalance, updateCasinoBalance } from '../../api/modules/casino';
import { radii } from '../../shared/design-system/tokens/radii';
import { getUserColor, getUserInitials } from '../../utils';
import { createLogger } from '../../utils/logger';
import CommentsThread from '../common/CommentsThread';
import BlackjackGame from '../TriviaCard/BlackjackGame';
import RouletteGame from '../TriviaCard/RouletteGame';
import SlotMachine from '../TriviaCard/SlotMachine';

import type { HighScoreEntry } from '@family-trivia/shared';

const logger = createLogger('CasinoLobby');

const gold = '#ffd700';
const darkBg = '#1a1a2e';
const frameBg = '#2c2c44';

const glow = keyframes`
  0%, 100% { text-shadow: 0 0 8px ${gold}; }
  50%      { text-shadow: 0 0 20px ${gold}, 0 0 40px ${alpha(gold, 0.4)}; }
`;

type ActiveGame = 'slots' | 'blackjack' | 'roulette' | null;

interface CasinoLobbyProps {
  userId: string;
  onClose: () => void;
}

const CasinoLobby: React.FC<CasinoLobbyProps> = ({ userId, onClose }) => {
  const theme = useTheme();
  const [balance, setBalance] = useState<number | null>(null);
  const [floor, setFloor] = useState(0);
  const [activeGame, setActiveGame] = useState<ActiveGame>(null);
  const [scores, setScores] = useState<HighScoreEntry[]>([]);

  const loadBalance = useCallback(async () => {
    try {
      const res = await getCasinoBalance(userId);
      setBalance(res.balance);
      setFloor(res.floor);
    } catch (err) {
      logger.error('Failed to load casino balance', err);
      setBalance(10);
    }
  }, [userId]);

  const loadScores = useCallback(async () => {
    try { setScores(await getArcadeLeaderboard('casino')); } catch { /* ok */ }
  }, []);

  useEffect(() => { loadBalance(); loadScores(); }, [loadBalance, loadScores]);

  const handleGameClose = useCallback(async () => {
    setActiveGame(null);
    await loadBalance();
    await loadScores();
  }, [loadBalance, loadScores]);

  // ── Active game fills the view ────────────────────────────────
  if (activeGame === 'slots') {
    return <SlotMachine userId={userId} groupId="" mode="arcade" onClose={handleGameClose} />;
  }
  if (activeGame === 'blackjack') {
    return <BlackjackGame userId={userId} onClose={handleGameClose} />;
  }
  if (activeGame === 'roulette') {
    return <RouletteGame userId={userId} onClose={handleGameClose} />;
  }

  // ── Lobby ─────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', width: '100%' }}>
      {/* Casino frame */}
      <Card sx={{
        bgcolor: darkBg, borderRadius: 3,
        border: `3px solid ${gold}`,
        overflow: 'hidden',
        boxShadow: `0 10px 40px rgba(0,0,0,0.6), inset 0 1px 0 ${alpha(gold, 0.2)}`,
      }}>
        {/* Header */}
        <Box sx={{
          bgcolor: frameBg, py: 1.25, px: 2,
          borderBottom: `2px solid ${gold}`,
          display: 'flex', alignItems: 'center',
        }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', color: alpha('#fff', 0.55) }}>
              CREDITS{' '}
              <Box component="span" sx={{ color: gold, fontWeight: 900, fontSize: '0.9rem' }}>
                {balance ?? '...'}
              </Box>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CasinoIcon sx={{ color: gold, fontSize: 20 }} />
            <Typography sx={{
              fontWeight: 900, color: gold, fontSize: '1rem', letterSpacing: 2,
              animation: `${glow} 2s ease-in-out infinite`,
            }}>
              CASINO
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton size="small" onClick={onClose} sx={{ color: alpha('#fff', 0.4), '&:hover': { color: '#fff' } }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Game tiles */}
        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }}>
          {/* Slots */}
          <Box onClick={() => setActiveGame('slots')} sx={{
            py: 2, borderRadius: `${radii.lg}px`,
            background: 'linear-gradient(135deg, #c62828, #ef6c00)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
            cursor: 'pointer', border: `2px solid ${alpha(gold, 0.2)}`,
            transition: 'all 0.15s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha('#000', 0.4)}` },
          }}>
            <CasinoIcon sx={{ fontSize: 30, color: '#ffd54f' }} />
            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.75rem' }}>Slots</Typography>
            <Typography sx={{ fontSize: '0.5rem', color: alpha('#fff', 0.65), letterSpacing: 1, fontWeight: 700 }}>BET & SPIN</Typography>
          </Box>

          {/* Blackjack */}
          <Box onClick={() => setActiveGame('blackjack')} sx={{
            py: 2, borderRadius: `${radii.lg}px`,
            background: 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
            cursor: 'pointer', border: `2px solid ${alpha(gold, 0.2)}`,
            transition: 'all 0.15s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha('#000', 0.4)}` },
          }}>
            <StyleIcon sx={{ fontSize: 30, color: gold }} />
            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.75rem' }}>Blackjack</Typography>
            <Typography sx={{ fontSize: '0.5rem', color: alpha('#fff', 0.65), letterSpacing: 1, fontWeight: 700 }}>HIT · STAND</Typography>
          </Box>

          {/* Roulette */}
          <Box onClick={() => setActiveGame('roulette')} sx={{
            py: 2, borderRadius: `${radii.lg}px`,
            background: 'linear-gradient(135deg, #1b5e20, #2e7d32, #4caf50)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75,
            cursor: 'pointer', border: `2px solid ${alpha(gold, 0.2)}`,
            transition: 'all 0.15s',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 6px 20px ${alpha('#000', 0.4)}` },
          }}>
            <FiberSmartRecordIcon sx={{ fontSize: 30, color: gold }} />
            <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: '0.75rem' }}>Roulette</Typography>
            <Typography sx={{ fontSize: '0.5rem', color: alpha('#fff', 0.65), letterSpacing: 1, fontWeight: 700 }}>RED · BLACK</Typography>
          </Box>
        </Box>

        {/* Floor info */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography sx={{ fontSize: '0.62rem', color: alpha('#fff', 0.3), textAlign: 'center' }}>
            Your trivia score ({floor} pts) is your safety net — you can never drop below it.
          </Typography>
        </Box>
      </Card>

      {/* Leaderboard */}
      <Card sx={{
        mt: 2, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 3,
      }}>
        <Box sx={{
          px: 2, py: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          background: `linear-gradient(135deg, ${alpha(gold, 0.08)}, transparent)`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <CasinoIcon sx={{ fontSize: 18, color: gold }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Casino High Scores
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: 1.5 }}>
          <ArcadeLeaderboard scores={scores} currentUserId={userId} maxItems={10} />
        </Box>
      </Card>

      {/* Comments */}
      <Card sx={{
        mt: 2, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 3,
      }}>
        <Box sx={{ p: 1.5 }}>
          <CommentsThread
            contentId="casino"
            contentType="arcade"
            currentUserId={userId}
            getUserColor={getUserColor}
            getUserInitials={getUserInitials}
            textOverrides={{ placeholderText: 'Talk about the casino...' }}
          />
        </Box>
      </Card>
    </Box>
  );
};

export default CasinoLobby;
