// File: src/features/arcade/ui/ArcadePage.tsx
// Arcade tab — swipeable game carousel with leaderboards. CSS scroll-snap.

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import { Box, Button, Card, IconButton, Typography, useTheme } from '@mui/material';
import { alpha, keyframes } from '@mui/material/styles';
import type React from 'react';
import { Suspense, useCallback, useRef, useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { HIGH_SCORES, useHighScores } from '../../../entities/high-scores';
import { LEADERBOARD } from '../../../entities/leaderboard';
import { ARCADE } from '../../../games/registry';
import { useCircleInvalidate } from '../../../shared/api/query';
import { colors } from '../../../shared/design-system/tokens/colors';
import { games } from '../../../shared/design-system/tokens/games';
import { shadows } from '../../../shared/design-system/tokens/shadows';
import { getUserColor, getUserInitials } from '../../../utils';
import { CommentsThread } from '../../comments';
import ArcadeLeaderboard from './ArcadeLeaderboard';

const fadeHint = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

// ── Component ─────────────────────────────────────────────────────

interface ArcadePageProps {
  userId: string;
}

const ArcadePage: React.FC<ArcadePageProps> = ({ userId }) => {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const currentGame = ARCADE[activeIndex] ?? ARCADE[0];
  // The games come from src/games, each its own folder (docs/decisions/0032).
  const scores = useHighScores(currentGame.id, currentGame.scores !== false);
  // A game saves its own score (and a podium place adds to the results).
  const invalidate = useCircleInvalidate();

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
    void invalidate(HIGH_SCORES, LEADERBOARD);
  }, [invalidate]);

  // ── Active game — no wrapper Card, each game has its own chrome + close button
  const playing = ARCADE.find((g) => g.id === activeGame);
  if (playing) {
    return (
      <Suspense fallback={<LoadingDots />}>
        <playing.Play userId={userId} onClose={handleGameClose} />
      </Suspense>
    );
  }

  // ── Carousel ────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Card
        sx={{
          mb: 2,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${alpha(games.arcade.headerFrom, 0.08)}, ${alpha(games.arcade.headerTo, 0.06)})`,
        }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
          <SportsEsportsIcon sx={{ fontSize: 22, color: theme.palette.secondary.main }} />
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>Arcade</Typography>
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
              position: 'absolute',
              left: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              width: 30,
              height: 30,
              bgcolor: alpha(theme.palette.background.paper, 0.92),
              boxShadow: shadows.md,
              border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
              '&:hover': { bgcolor: theme.palette.background.paper },
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
        )}
        {activeIndex < ARCADE.length - 1 && (
          <IconButton
            onClick={() => scrollTo(activeIndex + 1)}
            size="small"
            sx={{
              position: 'absolute',
              right: -4,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 2,
              width: 30,
              height: 30,
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
          {ARCADE.map((g, i) => (
            <Box
              key={g.id}
              onClick={() => scrollTo(i)}
              sx={{
                width: i === activeIndex ? 18 : 6,
                height: 6,
                borderRadius: 3,
                bgcolor:
                  i === activeIndex
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
          {ARCADE.map((game) => (
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
              <Card
                sx={{
                  overflow: 'hidden',
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                }}
              >
                {/* Game banner — matches trivia game mode tile style */}
                <Box
                  sx={{
                    background: game.look.gradient,
                    px: 2,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      color: game.look.accent,
                      fontSize: 0,
                      '& .MuiSvgIcon-root': { fontSize: 32 },
                    }}
                  >
                    <game.icon />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography
                        sx={{ fontWeight: 800, fontSize: '1.05rem', color: colors.onColor }}
                      >
                        {game.label}
                      </Typography>
                      <Box
                        sx={{
                          px: 0.75,
                          py: 0.15,
                          borderRadius: 1,
                          bgcolor: alpha(colors.scrim, 0.25),
                          fontSize: '0.5rem',
                          fontWeight: 800,
                          color: game.look.accent,
                          letterSpacing: 1,
                        }}
                      >
                        {game.badge}
                      </Box>
                    </Box>
                    <Typography sx={{ fontSize: '0.68rem', color: alpha(colors.onColor, 0.85) }}>
                      {game.description}
                    </Typography>
                  </Box>
                </Box>

                {/* Play button */}
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    color="secondary"
                    onClick={() => setActiveGame(game.id)}
                    sx={{
                      py: 1.25,
                      borderRadius: 2,
                      fontWeight: 700,
                      fontSize: '0.85rem',
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
        {ARCADE.length > 1 && activeIndex === 0 && (
          <Typography
            sx={{
              textAlign: 'center',
              mt: 0.5,
              fontSize: '0.6rem',
              color: theme.palette.text.disabled,
              animation: `${fadeHint} 3s ease-in-out 2`,
            }}
          >
            Swipe for more games →
          </Typography>
        )}
      </Box>

      {/* Leaderboard for current game */}
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
            background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.06)}, transparent)`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Box
              sx={{
                color: theme.palette.secondary.main,
                fontSize: 0,
                '& .MuiSvgIcon-root': { fontSize: 18 },
              }}
            >
              <currentGame.icon />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              {currentGame.label} High Scores
            </Typography>
          </Box>
        </Box>
        <Box sx={{ p: 1.5 }}>
          {scores.isLoading ? (
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: theme.palette.text.disabled,
                textAlign: 'center',
                py: 2,
              }}
            >
              Loading...
            </Typography>
          ) : (
            <ArcadeLeaderboard scores={scores.data ?? []} currentUserId={userId} maxItems={10} />
          )}
        </Box>
      </Card>

      {/* Comment thread for the currently-focused game.
          Each game has its own thread keyed by gameId so talk doesn't
          bleed across games. */}
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
