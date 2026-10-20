/**
 * CasinoLobby — shared entry point for casino games: blackjack, roulette,
 * and the games that say they're played here (`lobby: { of: 'casino' }` in
 * their folders, docs/decisions/0032).
 *
 * Shows the shared credit balance at the top, game tiles to pick from,
 * and a unified "Casino" leaderboard below. When a game is active, the
 * lobby hides and the game fills the view. On close, balance is synced
 * back to the shared pool.
 */

import type { HighScoreEntry } from '@family-trivia/shared';
import CasinoIcon from '@mui/icons-material/Casino';
import CloseIcon from '@mui/icons-material/Close';
import FiberSmartRecordIcon from '@mui/icons-material/FiberSmartRecord';
import StyleIcon from '@mui/icons-material/Style';
import { Box, Card, IconButton, Typography, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import type React from 'react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { getCasinoBalance } from '../../api/modules/casino';
import { LoadingDots } from '../../components/ui/feedback';
import { ArcadeLeaderboard } from '../../features/arcade';
import { CommentsThread } from '../../features/comments';
import { colors } from '../../shared/design-system/tokens/colors';
import { games } from '../../shared/design-system/tokens/games';
import { radii } from '../../shared/design-system/tokens/radii';
import { createLogger } from '../../shared/lib/logger';
import { getUserColor, getUserInitials } from '../../utils';
import { getScores } from '../kit';
import { gamesIn } from '../registry';
import BlackjackGame from './BlackjackGame';
import RouletteGame from './RouletteGame';

const logger = createLogger('CasinoLobby');

// The games played in this lobby, from their own folders.
const GUESTS = gamesIn('casino');

const { gold, cabinet: darkBg, header: frameBg } = games.casino;

const glow = keyframes`
  0%, 100% { text-shadow: 0 0 8px ${gold}; }
  50%      { text-shadow: 0 0 20px ${gold}, 0 0 40px ${alpha(gold, 0.4)}; }
`;

/** Blackjack, roulette, or the id of a game hosted here. */
type ActiveGame = string | null;

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
    try {
      setScores(await getScores('casino'));
    } catch {
      /* ok */
    }
  }, []);

  useEffect(() => {
    loadBalance();
    loadScores();
  }, [loadBalance, loadScores]);

  const handleGameClose = useCallback(async () => {
    setActiveGame(null);
    await loadBalance();
    await loadScores();
  }, [loadBalance, loadScores]);

  // ── Active game fills the view ────────────────────────────────
  const guest = GUESTS.find((g) => g.id === activeGame);
  if (guest) {
    return (
      <Suspense fallback={<LoadingDots />}>
        <guest.Play userId={userId} onClose={handleGameClose} />
      </Suspense>
    );
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
      <Card
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
            py: 1.25,
            px: 2,
            borderBottom: `2px solid ${gold}`,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.72rem', color: alpha(colors.onColor, 0.55) }}>
              CREDITS{' '}
              <Box component="span" sx={{ color: gold, fontWeight: 900, fontSize: '0.9rem' }}>
                {balance ?? '...'}
              </Box>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CasinoIcon sx={{ color: gold, fontSize: 20 }} />
            <Typography
              sx={{
                fontWeight: 900,
                color: gold,
                fontSize: '1rem',
                letterSpacing: 2,
                animation: `${glow} 2s ease-in-out infinite`,
              }}
            >
              CASINO
            </Typography>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <IconButton
              size="small"
              onClick={onClose}
              sx={{ color: alpha(colors.onColor, 0.4), '&:hover': { color: colors.onColor } }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        </Box>

        {/* Game tiles */}
        <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25 }}>
          {/* Games hosted here */}
          {GUESTS.map((g) => {
            const Icon = g.icon;
            return (
              <Box
                key={g.id}
                onClick={() => setActiveGame(g.id)}
                sx={{
                  py: 2,
                  borderRadius: `${radii.lg}px`,
                  background: g.lobby?.look.gradient,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.75,
                  cursor: 'pointer',
                  border: `2px solid ${alpha(gold, 0.2)}`,
                  transition: 'all 0.15s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 6px 20px ${alpha(colors.scrim, 0.4)}`,
                  },
                }}
              >
                <Icon sx={{ fontSize: 30, color: g.lobby?.look.accent }} />
                <Typography sx={{ fontWeight: 800, color: colors.onColor, fontSize: '0.75rem' }}>
                  {g.lobby?.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.5rem',
                    color: alpha(colors.onColor, 0.65),
                    letterSpacing: 1,
                    fontWeight: 700,
                  }}
                >
                  {g.lobby?.badge}
                </Typography>
              </Box>
            );
          })}

          {/* Blackjack */}
          <Box
            onClick={() => setActiveGame('blackjack')}
            sx={{
              py: 2,
              borderRadius: `${radii.lg}px`,
              background: games.casino.blackjackTile,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              border: `2px solid ${alpha(gold, 0.2)}`,
              transition: 'all 0.15s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 6px 20px ${alpha(colors.scrim, 0.4)}`,
              },
            }}
          >
            <StyleIcon sx={{ fontSize: 30, color: gold }} />
            <Typography sx={{ fontWeight: 800, color: colors.onColor, fontSize: '0.75rem' }}>
              Blackjack
            </Typography>
            <Typography
              sx={{
                fontSize: '0.5rem',
                color: alpha(colors.onColor, 0.65),
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              HIT · STAND
            </Typography>
          </Box>

          {/* Roulette */}
          <Box
            onClick={() => setActiveGame('roulette')}
            sx={{
              py: 2,
              borderRadius: `${radii.lg}px`,
              background: games.casino.rouletteTile,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              border: `2px solid ${alpha(gold, 0.2)}`,
              transition: 'all 0.15s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: `0 6px 20px ${alpha(colors.scrim, 0.4)}`,
              },
            }}
          >
            <FiberSmartRecordIcon sx={{ fontSize: 30, color: gold }} />
            <Typography sx={{ fontWeight: 800, color: colors.onColor, fontSize: '0.75rem' }}>
              Roulette
            </Typography>
            <Typography
              sx={{
                fontSize: '0.5rem',
                color: alpha(colors.onColor, 0.65),
                letterSpacing: 1,
                fontWeight: 700,
              }}
            >
              RED · BLACK
            </Typography>
          </Box>
        </Box>

        {/* Floor info */}
        <Box sx={{ px: 2, pb: 1.5 }}>
          <Typography
            sx={{ fontSize: '0.62rem', color: alpha(colors.onColor, 0.3), textAlign: 'center' }}
          >
            Your trivia score ({floor} pts) is your safety net — you can never drop below it.
          </Typography>
        </Box>
      </Card>

      {/* Leaderboard */}
      <Card
        sx={{
          mt: 2,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          borderRadius: 3,
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            background: `linear-gradient(135deg, ${alpha(gold, 0.08)}, transparent)`,
          }}
        >
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
      <Card
        sx={{
          mt: 2,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          borderRadius: 3,
        }}
      >
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
