// File: src/components/Arcade/ArcadePage.tsx
// Arcade tab — swipeable game carousel with leaderboards. CSS scroll-snap.

import AcUnitIcon from '@mui/icons-material/AcUnit';
import CasinoIcon from '@mui/icons-material/Casino';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import GamepadIcon from '@mui/icons-material/Gamepad';
import GridOnIcon from '@mui/icons-material/GridOn';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import {
  Box, Button, Card, IconButton, Typography, useTheme,
} from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import ArcadeLeaderboard from './ArcadeLeaderboard';
import { getArcadeLeaderboard } from '../../api/modules/arcade';
import { colors } from '../../shared/design-system/tokens/colors';
import { shadows } from '../../shared/design-system/tokens/shadows';
import { getUserColor, getUserInitials } from '../../utils';
import { createLogger } from '../../utils/logger';
import CasinoLobby from './CasinoLobby';
import CommentsThread from '../common/CommentsThread';
import CrosswordGame from '../TriviaCard/CrosswordGame';
import CurlingGame from '../TriviaCard/CurlingGame';
import SnakeGame from '../TriviaCard/SnakeGame';
import TetrisGame from '../TriviaCard/TetrisGame';

import type { ArcadeGameId, HighScoreEntry } from '@family-trivia/shared';

const logger = createLogger('ArcadePage');

const fadeHint = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

// ── Game Config ───────────────────────────────────────────────────

interface GameConfig {
  id: ArcadeGameId;
  label: string;
  description: string;
  gradient: string;
  accentColor: string;
  badge: string;
  icon: React.ReactElement;
}

// Same gradients, icons, accents, and badges as the trivia game mode tiles
// in CategorySelect — keeps visual identity consistent across tabs.
// Slot machine is always first. Other games ordered by play frequency at runtime.
const GAMES: GameConfig[] = [
  {
    id: 'casino' as ArcadeGameId,
    label: 'Casino',
    description: 'Slots + Blackjack — shared credit pool',
    gradient: 'linear-gradient(135deg, #1a1a2e 0%, #2c2c44 50%, #0f3460 100%)',
    accentColor: '#ffd700',
    badge: 'SLOTS · 21',
    icon: <CasinoIcon />,
  },
  {
    id: 'tetris',
    label: 'Tetris',
    description: '60 seconds to clear as many lines as you can',
    gradient: colors.gameMode.tetris.gradient,
    accentColor: colors.gameMode.tetris.accent,
    badge: '60s BLOCKS',
    icon: <GamepadIcon />,
  },
  {
    id: 'curling',
    label: 'Curling',
    description: 'Hold and release — land closest to the button',
    gradient: colors.gameMode.curling.gradient,
    accentColor: colors.gameMode.curling.accent,
    badge: 'HOLD · SWEEP',
    icon: <AcUnitIcon />,
  },
  {
    id: 'crossword',
    label: 'Crossword',
    description: 'Family facts turned into a crossword puzzle',
    gradient: colors.gameMode.crossword.gradient,
    accentColor: colors.gameMode.crossword.accent,
    badge: 'WORD PUZZLE',
    icon: <GridOnIcon />,
  },
  {
    id: 'snake',
    label: 'Snake',
    description: 'Collect letters to spell trivia answers',
    gradient: colors.gameMode.snake.gradient,
    accentColor: colors.gameMode.snake.accent,
    badge: 'SPELL IT',
    icon: <SportsEsportsIcon />,
  },
];

// ── Component ─────────────────────────────────────────────────────

interface ArcadePageProps {
  userId: string;
}

const ArcadePage: React.FC<ArcadePageProps> = ({ userId }) => {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeGame, setActiveGame] = useState<ArcadeGameId | null>(null);
  const [leaderboards, setLeaderboards] = useState<Record<string, HighScoreEntry[]>>({});
  const [loadingScores, setLoadingScores] = useState(true);

  // Load leaderboards
  const refreshLeaderboards = useCallback(async () => {
    setLoadingScores(true);
    try {
      const results = await Promise.all(GAMES.map(g => getArcadeLeaderboard(g.id)));
      const boards: Record<string, HighScoreEntry[]> = {};
      GAMES.forEach((g, i) => { boards[g.id] = results[i]; });
      setLeaderboards(boards);
    } catch (err) {
      logger.error('Failed to load leaderboards', err);
    } finally {
      setLoadingScores(false);
    }
  }, []);

  useEffect(() => { refreshLeaderboards(); }, [refreshLeaderboards]);

  // Track scroll position for dots
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const cardWidth = scrollRef.current.offsetWidth;
    setActiveIndex(Math.round(scrollRef.current.scrollLeft / cardWidth));
  }, []);

  const scrollTo = useCallback((idx: number) => {
    scrollRef.current?.scrollTo({
      left: idx * (scrollRef.current?.offsetWidth ?? 0),
      behavior: 'smooth',
    });
  }, []);

  const handleGameClose = useCallback(() => {
    setActiveGame(null);
    refreshLeaderboards();
  }, [refreshLeaderboards]);

  // ── Active game — no wrapper Card, each game has its own chrome + close button
  if (activeGame) {
    return (
      <Box>
        {activeGame === ('casino' as ArcadeGameId) && (
          <CasinoLobby userId={userId} onClose={handleGameClose} />
        )}
        {activeGame === 'tetris' && (
          <TetrisGame userId={userId} mode="arcade" onClose={handleGameClose} />
        )}
        {activeGame === 'curling' && (
          <CurlingGame userId={userId} mode="arcade" onClose={handleGameClose} />
        )}
        {activeGame === 'crossword' && (
          <CrosswordGame userId={userId} onClose={handleGameClose} />
        )}
        {activeGame === 'snake' && (
          <SnakeGame userId={userId} onClose={handleGameClose} />
        )}
      </Box>
    );
  }

  // ── Carousel ────────────────────────────────────────────────────
  const currentGame = GAMES[activeIndex] ?? GAMES[0];

  return (
    <Box>
      {/* Header */}
      <Card sx={{
        mb: 2, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha('#7b1fa2', 0.08)}, ${alpha('#1976d2', 0.06)})`,
      }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SportsEsportsIcon sx={{ fontSize: 22, color: theme.palette.secondary.main }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>
              Arcade
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary }}>
              Swipe to pick a game — play for high scores
            </Typography>
          </Box>
        </Box>
      </Card>

      {/* Navigation arrows */}
      <Box sx={{ position: 'relative' }}>
        {activeIndex > 0 && (
          <IconButton
            onClick={() => scrollTo(activeIndex - 1)}
            size="small"
            sx={{
              position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
              width: 30, height: 30,
              bgcolor: alpha(theme.palette.background.paper, 0.92),
              boxShadow: shadows.md,
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              '&:hover': { bgcolor: theme.palette.background.paper },
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        {activeIndex < GAMES.length - 1 && (
          <IconButton
            onClick={() => scrollTo(activeIndex + 1)}
            size="small"
            sx={{
              position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 2,
              width: 30, height: 30,
              bgcolor: alpha(theme.palette.background.paper, 0.92),
              boxShadow: shadows.md,
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              '&:hover': { bgcolor: theme.palette.background.paper },
            }}
          >
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}

        {/* Dot indicators */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 1 }}>
          {GAMES.map((g, i) => (
            <Box
              key={g.id}
              onClick={() => scrollTo(i)}
              sx={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                bgcolor: i === activeIndex
                  ? theme.palette.secondary.main
                  : alpha(theme.palette.text.disabled, 0.25),
                transition: 'all 0.25s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </Box>

        {/* Scrollable game cards */}
        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            display: 'flex',
            overflowX: 'auto',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            '&::-webkit-scrollbar': { display: 'none' },
            scrollbarWidth: 'none',
            scrollBehavior: 'smooth',
            mx: 1,
          }}
        >
          {GAMES.map((game) => (
            <Box
              key={game.id}
              sx={{
                scrollSnapAlign: 'center',
                minWidth: '100%',
                maxWidth: '100%',
                flexShrink: 0,
                px: 0.5,
                boxSizing: 'border-box',
              }}
            >
              <Card sx={{
                overflow: 'hidden',
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
              }}>
                {/* Game banner — matches trivia game mode tile style */}
                <Box sx={{
                  background: game.gradient,
                  px: 2, py: 2,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                }}>
                  <Box sx={{
                    color: game.accentColor, fontSize: 0,
                    '& .MuiSvgIcon-root': { fontSize: 32 },
                  }}>
                    {game.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#fff' }}>
                        {game.label}
                      </Typography>
                      <Box sx={{
                        px: 0.75, py: 0.15, borderRadius: 1,
                        bgcolor: alpha('#000', 0.25),
                        fontSize: '0.5rem', fontWeight: 800,
                        color: game.accentColor, letterSpacing: 1,
                      }}>
                        {game.badge}
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.68rem', color: alpha('#fff', 0.85) }}>
                      {game.description}
                    </Typography>
                  </Box>
                </Box>

                {/* Play button */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Button
                    fullWidth variant="contained" color="secondary"
                    onClick={() => setActiveGame(game.id)}
                    sx={{
                      py: 1.25, borderRadius: 2,
                      fontWeight: 700, fontSize: '0.85rem',
                      textTransform: 'none',
                    }}
                  >
                    Play {game.label}
                  </Button>
                </Box>
              </Card>
            </Box>
          ))}
        </Box>

        {/* Swipe hint */}
        {GAMES.length > 1 && activeIndex === 0 && (
          <Typography sx={{
            textAlign: 'center', mt: 0.5,
            fontSize: '0.6rem', color: theme.palette.text.disabled,
            animation: `${fadeHint} 3s ease-in-out 2`,
          }}>
            Swipe for more games →
          </Typography>
        )}
      </Box>

      {/* Leaderboard for current game */}
      <Card sx={{
        mt: 2, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 3,
      }}>
        <Box sx={{
          px: 2, py: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.06)}, transparent)`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box sx={{ color: theme.palette.secondary.main, fontSize: 0, '& .MuiSvgIcon-root': { fontSize: 18 } }}>
              {currentGame.icon}
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {currentGame.label} High Scores
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: 1.5 }}>
          {loadingScores ? (
            <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.disabled, textAlign: 'center', py: 2 }}>
              Loading...
            </Typography>
          ) : (
            <ArcadeLeaderboard
              scores={leaderboards[currentGame.id] ?? []}
              currentUserId={userId}
              maxItems={10}
            />
          )}
        </Box>
      </Card>

      {/* Comment thread for the currently-focused game.
          Each game has its own thread keyed by gameId so talk doesn't
          bleed across games. */}
      <Card sx={{
        mt: 2, overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 3,
      }}>
        <Box sx={{ p: 1.5 }}>
          <CommentsThread
            contentId={currentGame.id}
            contentType="arcade"
            currentUserId={userId}
            getUserColor={getUserColor}
            getUserInitials={getUserInitials}
            textOverrides={{ placeholderText: `Talk about ${currentGame.label}...` }}
          />
        </Box>
      </Card>
    </Box>
  );
};

export default ArcadePage;
