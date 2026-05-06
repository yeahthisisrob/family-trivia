// File: frontend/src/components/UpcomingDates/index.tsx
import AddIcon from '@mui/icons-material/Add';
import CakeIcon from '@mui/icons-material/Cake';
import CelebrationIcon from '@mui/icons-material/Celebration';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ListIcon from '@mui/icons-material/List';
import StarIcon from '@mui/icons-material/Star';
import {
  Box,
  Card,
  Typography,
  Chip,
  IconButton,
  useTheme,
  Skeleton,
  Fade,
  Button,
  keyframes,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState, useEffect, useRef } from 'react';
import ConfettiExplosion from 'react-confetti-explosion';

import AddCelebrationDialog from './AddCelebrationDialog';
import AllCelebrationsDialog from './AllCelebrationsDialog';
import { Birthday, getUpcomingBirthdays } from '../../api/modules/celebrations';
import { loadSession } from '../../session';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('UpcomingDates');

const pulseGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,152,0,0.4); }
  50% { box-shadow: 0 0 0 8px rgba(255,152,0,0); }
`;

// ---------------------------------------------------------------------------
// Birthday card
// ---------------------------------------------------------------------------

const BirthdayCard: React.FC<{ birthday: Birthday; isToday?: boolean }> = ({
  birthday, isToday = false,
}) => {
  const theme = useTheme();

  const fmt = (m: number, d: number, yr?: number) => {
    const s = new Date(2024, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return yr ? `${s}, ${yr}` : s;
  };
  const daysText = (days: number) => {
    if (days === 0) return 'Today!';
    if (days === 1) return 'Tomorrow';
    if (days <= 7) return `${days}d`;
    if (days <= 30) return `${Math.floor(days / 7)}w`;
    return fmt(birthday.month, birthday.day);
  };
  const typeColor: Record<string, string> = {
    anniversary: theme.palette.error.main,
    holiday: theme.palette.success.main,
    other: theme.palette.warning.main,
    birthday: theme.palette.primary.main,
  };
  const typeIcon: Record<string, React.ReactElement> = {
    anniversary: <FavoriteIcon sx={{ fontSize: 14 }} />,
    holiday: <CelebrationIcon sx={{ fontSize: 14 }} />,
    other: <StarIcon sx={{ fontSize: 14 }} />,
    birthday: <CakeIcon sx={{ fontSize: 14 }} />,
  };
  const color = typeColor[birthday.type || 'birthday'];
  const icon = typeIcon[birthday.type || 'birthday'];
  const bAny = birthday as any;

  return (
    <Box sx={{
      minWidth: isToday ? 150 : 115, p: 1.5, borderRadius: 2,
      bgcolor: isToday ? alpha(color, 0.08) : alpha(theme.palette.background.default, 0.5),
      border: `1px solid ${isToday ? alpha(color, 0.3) : alpha(theme.palette.divider, 0.1)}`,
      textAlign: 'center', transition: 'all 0.2s',
      '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 4px 12px ${alpha('#000', 0.08)}` },
    }}>
      {isToday && <CelebrationIcon sx={{ fontSize: 22, color, mb: 0.5, display: 'block', mx: 'auto' }} />}
      <Typography sx={{ fontWeight: 700, fontSize: isToday ? '0.85rem' : '0.78rem', mb: 0.2, lineHeight: 1.2 }}>
        {birthday.name}
      </Typography>
      <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.secondary, mb: 0.4 }}>
        {fmt(birthday.month, birthday.day, !bAny.recurring ? bAny.year : undefined)}
      </Typography>
      {birthday.description && (
        <Typography sx={{ fontSize: '0.55rem', color: theme.palette.text.disabled, fontStyle: 'italic', mb: 0.4, lineHeight: 1.2 }}>
          {birthday.description}
        </Typography>
      )}
      <Chip icon={icon} label={daysText(birthday.daysUntil)} size="small" sx={{
        height: 18, fontSize: '0.55rem', fontWeight: 600,
        bgcolor: isToday ? color : alpha(color, 0.1),
        color: isToday ? '#fff' : color,
        '& .MuiChip-icon': { fontSize: 11, color: isToday ? '#fff' : color },
      }} />
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const DISMISS_KEY = 'celebrations_cta_dismissed';

const UpcomingDates: React.FC = () => {
  const theme = useTheme();
  const currentUserId = loadSession() || '';

  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [displayLimit, setDisplayLimit] = useState(10);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAllDialog, setShowAllDialog] = useState(false);
  const [refreshAllDialog, setRefreshAllDialog] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Show CTA if user hasn't dismissed it recently
  const [showCta, setShowCta] = useState(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return true;
    return Date.now() - parseInt(dismissed, 10) > 7 * 24 * 60 * 60 * 1000; // 1 week
  });

  useEffect(() => {
    const timer = setTimeout(() => fetchBirthdays(), 2000);
    return () => clearTimeout(timer);
  }, []);

  const fetchBirthdays = async (limit = displayLimit, isLoadMore = false) => {
    try {
      if (isLoadMore) setLoadingMore(true);
      else { setLoading(true); setError(false); }
      // Request one extra to detect if there are more
      const response = await getUpcomingBirthdays(limit + 1);
      const upcoming = response.birthdays;
      setHasMore(upcoming.length > limit);
      setBirthdays(upcoming.slice(0, limit));
      setTodaysBirthdays(response.todaysBirthdays);
      if (response.todaysBirthdays.length > 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }
      // If user has celebrations, hide CTA
      if (response.birthdays.length + response.todaysBirthdays.length > 3) {
        setShowCta(false);
      }
    } catch (err) {
      logger.error('Failed to fetch birthdays', err);
      if (!isLoadMore) setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const dismissCta = () => {
    setShowCta(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const loadMoreRef = useRef(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

      // Load more when scrolled near the end
      const nearEnd = scrollLeft > scrollWidth - clientWidth - 120;
      if (nearEnd && hasMore && !loadingMore && !loadMoreRef.current) {
        loadMoreRef.current = true;
        const newLimit = displayLimit + 10;
        setDisplayLimit(newLimit);
        fetchBirthdays(newLimit, true).finally(() => { loadMoreRef.current = false; });
      }
    }
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (el) {
      el.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);
      return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll); };
    }
  }, [birthdays, todaysBirthdays]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -180 : 180, behavior: 'smooth' });
  };

  // Loading
  if (loading) {
    return (
      <Card sx={{ mb: 2, overflow: 'hidden', borderRadius: 3,
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,
      }}>
        <Box sx={{
          px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)}, ${alpha(theme.palette.warning.dark, 0.04)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}>
          <CelebrationIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Upcoming Celebrations</Typography>
        </Box>
        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" width={115} height={80} sx={{ borderRadius: 2 }} />)}
        </Box>
      </Card>
    );
  }

  // Empty + error → only show if CTA should be visible
  if ((error || (birthdays.length === 0 && todaysBirthdays.length === 0)) && !showCta) return null;

  return (
    <>
      {showConfetti && (
        <Box sx={{ position: 'fixed', top: '50%', left: '50%', zIndex: 9999 }}>
          <ConfettiExplosion force={0.8} duration={3000} particleCount={200} width={1600}
            colors={['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F']} />
        </Box>
      )}

      <Fade in={true} timeout={800}>
        <Card sx={{
          mb: 2, overflow: 'hidden', borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,
        }}>
          {/* Header */}
          <Box sx={{
            px: 2, py: 1.25,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.08)}, ${alpha(theme.palette.warning.dark, 0.04)})`,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CelebrationIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Upcoming Celebrations
              </Typography>
              {todaysBirthdays.length > 0 && (
                <Chip label={`${todaysBirthdays.length} today!`} size="small" sx={{
                  height: 20, fontSize: '0.6rem', fontWeight: 700,
                  bgcolor: alpha(theme.palette.warning.main, 0.15),
                  color: theme.palette.warning.dark,
                }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.25 }}>
              <IconButton size="small" onClick={() => setShowAddDialog(true)}
                sx={{
                  color: theme.palette.text.secondary,
                  '&:hover': { color: theme.palette.warning.main },
                  // Pulse animation when CTA is active
                  ...(showCta && {
                    animation: `${pulseGlow} 2s ease-in-out infinite`,
                    color: theme.palette.warning.main,
                  }),
                }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
              <IconButton size="small" onClick={() => setShowAllDialog(true)}
                sx={{ color: theme.palette.text.secondary, '&:hover': { color: theme.palette.warning.main } }}>
                <ListIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          </Box>

          {/* CTA for new users */}
          {showCta && birthdays.length + todaysBirthdays.length <= 3 && (
            <Box sx={{
              px: 2, py: 1.5,
              bgcolor: alpha(theme.palette.warning.main, 0.04),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, mb: 0.25 }}>
                  Add your family's important dates!
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary, lineHeight: 1.3 }}>
                  Anniversaries, pet birthdays, 5K races, vacations, family reunions — never miss a celebration.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <Button size="small" variant="contained" onClick={() => setShowAddDialog(true)}
                  startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                  sx={{
                    fontSize: '0.7rem', py: 0.5, px: 1.5, borderRadius: 2,
                    bgcolor: theme.palette.warning.main, '&:hover': { bgcolor: theme.palette.warning.dark },
                    animation: `${pulseGlow} 2s ease-in-out infinite`,
                  }}>
                  Add
                </Button>
                <Button size="small" onClick={dismissCta}
                  sx={{ fontSize: '0.6rem', color: theme.palette.text.disabled, minWidth: 0, px: 1 }}>
                  Later
                </Button>
              </Box>
            </Box>
          )}

          {/* Today's celebrations banner */}
          {todaysBirthdays.length > 0 && (
            <Box sx={{
              px: 2, py: 1.25,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              textAlign: 'center',
            }}>
              {todaysBirthdays.map((c, i) => (
                <Typography key={i} sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                  {c.type === 'birthday' && `🎂 Happy Birthday ${c.name}!`}
                  {c.type === 'anniversary' && `💕 Happy Anniversary ${c.name}!`}
                  {c.type === 'holiday' && `🎊 ${c.name}!`}
                  {c.type === 'other' && `⭐ ${c.name}!`}
                </Typography>
              ))}
            </Box>
          )}

          {/* Scrollable cards */}
          {(birthdays.length > 0 || todaysBirthdays.length > 0) && (
            <Box sx={{ position: 'relative', px: 1.5, py: 1.5 }}>
              {canScrollLeft && (
                <IconButton onClick={() => scroll('left')} size="small" sx={{
                  position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)',
                  zIndex: 2, bgcolor: theme.palette.background.paper,
                  boxShadow: `0 2px 8px ${alpha('#000', 0.12)}`, width: 28, height: 28,
                  '&:hover': { bgcolor: theme.palette.action.hover },
                }}>
                  <ChevronLeftIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
              {canScrollRight && (
                <IconButton onClick={() => scroll('right')} size="small" sx={{
                  position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)',
                  zIndex: 2, bgcolor: theme.palette.background.paper,
                  boxShadow: `0 2px 8px ${alpha('#000', 0.12)}`, width: 28, height: 28,
                  '&:hover': { bgcolor: theme.palette.action.hover },
                }}>
                  <ChevronRightIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}

              <Box ref={scrollRef} sx={{
                display: 'flex', gap: 1, overflowX: 'auto', overflowY: 'hidden',
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
                scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
                px: 0.5,
              }}>
                {todaysBirthdays.map((b, i) => (
                  <Box key={`today-${b.userId}-${i}`} sx={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <BirthdayCard birthday={b} isToday />
                  </Box>
                ))}
                {birthdays.map((b, i) => (
                  <Box key={`upcoming-${b.userId}-${i}`} sx={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                    <BirthdayCard birthday={b} />
                  </Box>
                ))}
                {loadingMore && (
                  <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center', px: 1 }}>
                    <LoadingDots size={4} inline />
                  </Box>
                )}
                <Box sx={{ minWidth: 12, flexShrink: 0 }} />
              </Box>
              {/* Right fade hint when more content is available */}
              {(canScrollRight || hasMore) && (
                <Box sx={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 40,
                  background: `linear-gradient(to right, transparent, ${theme.palette.background.paper})`,
                  pointerEvents: 'none', zIndex: 1,
                }} />
              )}
            </Box>
          )}
        </Card>
      </Fade>

      <AddCelebrationDialog open={showAddDialog} onClose={() => setShowAddDialog(false)}
        onSuccess={() => { fetchBirthdays(); setShowAddDialog(false); setRefreshAllDialog(p => p + 1); dismissCta(); }}
        currentUserId={currentUserId} />
      <AllCelebrationsDialog open={showAllDialog} onClose={() => setShowAllDialog(false)}
        currentUserId={currentUserId} onDeleted={fetchBirthdays} refreshTrigger={refreshAllDialog} />
    </>
  );
};

export default UpcomingDates;
