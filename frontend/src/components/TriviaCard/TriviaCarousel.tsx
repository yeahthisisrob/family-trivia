// File: src/components/TriviaCard/TriviaCarousel.tsx
// Swipeable card carousel for the trivia tab.
// History cards (left) → Active card (center) → Preview (right)
// Uses CSS scroll-snap — no library needed.

import { getSecondsElapsedTodayET } from '@family-trivia/shared';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import {
  Box, Card, Chip, IconButton, Typography,
  alpha, keyframes, useTheme,
} from '@mui/material';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import HistoryCard from './HistoryCard';
import TriviaFlow from './TriviaFlow';
import { getUserProfile, QuestionHistory } from '../../api/modules/user';
import { useTimeline } from '../../contexts/TimelineContext';
import { useTriviaFlow } from '../../contexts/TriviaFlowContext';
import { useUserStatus } from '../../contexts/UserStatusContext';
import { colors } from '../../shared/design-system/tokens/colors';
import { radii } from '../../shared/design-system/tokens/radii';
import { shadows } from '../../shared/design-system/tokens/shadows';

import type { Question } from '../../api/modules/trivia';

const fadeHint = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
`;

interface TriviaCarouselProps {
  userId: string;
  groupId: string;
  onAnswerResult?: (result: { correct: boolean; streak: number; pointsEarned?: number }, question?: Question, selected?: string | null) => void;
  forceDisabled?: boolean;
}

// No limit — all history is swipeable. Cards are lightweight (no API calls).
// Oldest on the far left, newest closest to the active card.

const TriviaCarousel: React.FC<TriviaCarouselProps> = ({ userId, groupId, onAnswerResult, forceDisabled }) => {
  const theme = useTheme();
  const scrollRef = useRef<HTMLDivElement>(null);
  const { hasAnsweredToday, canAnswerQuestion: ctxCanAnswer } = useUserStatus();
  const { isActive: flowActive } = useTriviaFlow();

  const [history, setHistory] = useState<QuestionHistory[]>([]);
  const [activeIndex, setActiveIndex] = useState(() => history.length);
  const isDone = hasAnsweredToday && !ctxCanAnswer;

  // Countdown for "next question" when done
  const calcCountdown = () => {
    const remaining = 24 * 60 * 60 - getSecondsElapsedTodayET();
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const [countdown, setCountdown] = useState(calcCountdown);
  useEffect(() => {
    const id = setInterval(() => setCountdown(calcCountdown), 30_000);
    return () => clearInterval(id);
  }, []);

  // Load recent history — clear + refetch when userId changes
  useEffect(() => {
    if (forceDisabled) return;
    let cancelled = false;
    // Clear in the async callback to avoid synchronous setState in effect body
    const load = async () => {
      try {
        const p = await getUserProfile(userId);
        if (cancelled) return;
        const recent = (p.history || [])
          .filter((h: QuestionHistory) => h.question && h.selectedAnswer)
          .reverse();
        setHistory(recent);
      } catch {
        if (!cancelled) setHistory([]);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [userId, forceDisabled]);

  // Total cards: history + active + (preview if done)
  const totalCards = history.length + 1 + (isDone ? 1 : 0);
  const activeCardIndex = history.length; // active is right after history

  // Scroll to active card on mount, when history loads, when flowActive
  // changes (returning from active → idle), AND when the container becomes
  // visible (we're inside a display:none tab wrapper on first mount).
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    if (flowActive) return; // no carousel to scroll when active
    if (!scrollRef.current) return;
    const container = scrollRef.current;

    const scrollToActive = () => {
      const cardWidth = container.offsetWidth;
      if (cardWidth === 0) return false; // container not visible yet
      container.scrollLeft = activeCardIndex * cardWidth;
      return true;
    };

    // Reset the scrolled flag so we scroll again
    hasScrolledRef.current = false;

    // Delay one frame so the DOM has painted (history cards may have
    // just re-entered after flowActive went false).
    const raf = requestAnimationFrame(() => {
      if (scrollToActive()) hasScrolledRef.current = true;
    });

    // Watch for visibility / size changes (tab becomes visible)
    const observer = new ResizeObserver(() => {
      if (!hasScrolledRef.current && scrollToActive()) {
        hasScrolledRef.current = true;
      }
    });
    observer.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [history.length, activeCardIndex, flowActive]);

  // Track scroll position for dot indicators
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const cardWidth = container.offsetWidth;
    const idx = Math.round(container.scrollLeft / cardWidth);
    setActiveIndex(idx);
  }, []);

  // Pre-fetch comments for the visible history card + next one.
  // Fire-and-forget — results go into the TimelineContext Map.
  const { fetchTriviaCommentsForId } = useTimeline();
  useEffect(() => {
    [activeIndex, activeIndex + 1].forEach(idx => {
      if (idx >= 0 && idx < history.length) {
        const h = history[idx];
        fetchTriviaCommentsForId(`${userId}_${h.timestamp}`);
      }
    });
  }, [activeIndex, history, userId, fetchTriviaCommentsForId]);

  if (forceDisabled) return null;

  const canGoLeft = activeIndex > 0;
  const canGoRight = activeIndex < totalCards - 1;

  const scrollTo = (idx: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({
      left: idx * scrollRef.current.offsetWidth,
      behavior: 'smooth',
    });
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Navigation arrows — hidden during active flow */}
      {!flowActive && canGoLeft && (
        <IconButton
          onClick={() => scrollTo(activeIndex - 1)}
          size="small"
          sx={{
            position: 'absolute',
            left: -4,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            width: 32,
            height: 32,
            bgcolor: alpha(colors.surface.card, 0.92),
            boxShadow: shadows.md,
            border: `1px solid ${alpha(colors.border.light, 0.5)}`,
            '&:hover': { bgcolor: colors.surface.card },
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: 20, color: colors.text.secondary }} />
        </IconButton>
      )}
      {!flowActive && canGoRight && (
        <IconButton
          onClick={() => scrollTo(activeIndex + 1)}
          size="small"
          sx={{
            position: 'absolute',
            right: -4,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 2,
            width: 32,
            height: 32,
            bgcolor: alpha(colors.surface.card, 0.92),
            boxShadow: shadows.md,
            border: `1px solid ${alpha(colors.border.light, 0.5)}`,
            '&:hover': { bgcolor: colors.surface.card },
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 20, color: colors.text.secondary }} />
        </IconButton>
      )}

      {/* Dot indicators — hidden during active flow */}
      {!flowActive && (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 0.5, mb: 1 }}>
          {Array.from({ length: totalCards }).map((_, i) => {
            const isCurrent = i === activeIndex;
            const isActiveDot = i === activeCardIndex;
            return (
              <Box
                key={i}
                onClick={() => scrollTo(i)}
                sx={{
                  width: isCurrent ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: isActiveDot
                    ? colors.brand.primary
                    : isCurrent
                      ? colors.text.secondary
                      : alpha(colors.text.disabled, 0.25),
                  transition: 'all 0.25s ease',
                  cursor: 'pointer',
                }}
              />
            );
          })}
        </Box>
      )}

      {/* Carousel container — single TriviaFlow instance always mounted.
          When active: history/preview hidden, scroll locked, flow owns full width.
          When idle/done: full carousel with history browsing. */}
      <Box
        ref={scrollRef}
        onScroll={flowActive ? undefined : handleScroll}
        sx={{
          display: 'flex',
          overflowX: flowActive ? 'hidden' : 'auto',
          scrollSnapType: flowActive ? 'none' : 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          '&::-webkit-scrollbar': { display: 'none' },
          scrollbarWidth: 'none',
          scrollBehavior: 'smooth',
          mx: flowActive ? 0 : 1,
        }}
      >
        {/* History cards (left side) — hidden during active flow */}
        {!flowActive && history.map((h, i) => (
          <Box
            key={`history-${h.timestamp}-${i}`}
            sx={{
              scrollSnapAlign: 'center',
              minWidth: '100%',
              maxWidth: '100%',
              flexShrink: 0,
              px: 1,
              boxSizing: 'border-box',
            }}
          >
            <HistoryCard
              userId={userId}
              question={h.question?.question || ''}
              choices={h.question?.choices || []}
              answer={h.question?.answer || ''}
              selectedAnswer={h.selectedAnswer || ''}
              correct={h.correct}
              category={h.question?.category}
              pointsEarned={h.pointsEarned}
              timestamp={h.timestamp}
            />
          </Box>
        ))}

        {/* Active card — TriviaFlow always mounted, never remounted */}
        <Box
          sx={{
            scrollSnapAlign: flowActive ? undefined : 'center',
            minWidth: '100%',
            maxWidth: '100%',
            flexShrink: 0,
            px: 1,
            boxSizing: 'border-box',
          }}
        >
          <TriviaFlow
            userId={userId}
            groupId={groupId}
            onAnswerResult={onAnswerResult}
            forceDisabled={forceDisabled}
          />
        </Box>

        {/* Preview card (right side) — only when done + not active */}
        {!flowActive && isDone && (
          <Box
            sx={{
              scrollSnapAlign: 'center',
              minWidth: '100%',
              maxWidth: '100%',
              flexShrink: 0,
              px: 1,
              boxSizing: 'border-box',
            }}
          >
            <Card sx={{
              overflow: 'hidden', borderRadius: `${radii.xl}px`,
              boxShadow: shadows.card,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              position: 'relative',
            }}>
              <Box sx={{
                px: 2, py: 1.25,
                background: `linear-gradient(135deg, ${alpha(colors.brand.primary, 0.06)}, ${alpha(colors.brand.primaryDark, 0.03)})`,
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
              }}>
                <AccessTimeIcon sx={{ fontSize: 16, color: colors.text.secondary }} />
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: colors.text.secondary }}>
                  Next question in {countdown}
                </Typography>
              </Box>
              <Box sx={{ p: 3, textAlign: 'center', opacity: 0.4 }}>
                <Typography sx={{ fontSize: '0.85rem', color: colors.text.secondary }}>
                  Come back tomorrow for your next trivia question
                </Typography>
                <Chip label="Categories will appear here" size="small"
                  sx={{ mt: 2, fontSize: '0.7rem' }} />
              </Box>
            </Card>
          </Box>
        )}
      </Box>

      {/* Swipe hint — only when idle/done with history */}
      {!flowActive && history.length > 0 && activeIndex === activeCardIndex && (
        <Typography sx={{
          textAlign: 'center', mt: 0.75,
          fontSize: '0.65rem', color: colors.text.disabled,
          animation: `${fadeHint} 3s ease-in-out`,
          animationIterationCount: 2,
        }}>
          ← Swipe to see past questions
        </Typography>
      )}
    </Box>
  );
};

export default TriviaCarousel;
