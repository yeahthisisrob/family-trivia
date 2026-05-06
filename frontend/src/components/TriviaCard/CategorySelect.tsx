// src/components/TriviaCard/CategorySelect.tsx

import { GAME_MODES, GameModeId , getSecondsElapsedTodayET } from '@family-trivia/shared';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AddIcon from '@mui/icons-material/Add';
import CasinoIcon from '@mui/icons-material/Casino';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import GamepadIcon from '@mui/icons-material/Gamepad';
import HistoryIcon from '@mui/icons-material/History';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import LockIcon from '@mui/icons-material/Lock';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import MovieIcon from '@mui/icons-material/Movie';
import PlaceIcon from '@mui/icons-material/Place';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PublicIcon from '@mui/icons-material/Public';
import ScienceIcon from '@mui/icons-material/Science';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import StarsIcon from '@mui/icons-material/Stars';
import {
  Card,
  Typography,
  Box,
  IconButton,
  useTheme,
  alpha,
  Tooltip,
  Chip,
} from '@mui/material';
import React from 'react';

import { SystemCategory, CustomCategory } from '../../api';
import appStrings from '../../constants/strings';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { useLeaderboard } from '../../contexts/LeaderboardContext';
import { useTrivia } from '../../contexts/TriviaContext';
import { LoadingDots } from '../ui/feedback';


// Feature flags — per-mode toggles. Matches GAME_MODES registry order.
const ENABLED_MODES: Record<GameModeId, boolean> = {
  'casino-rush': true,
  'slot-machine': true,
  'curling': true,
  'tetris': true,
};

// Visual theme per game mode — tile appearance. Kept here so the
// registry stays data-only; UI details live with the UI.
interface GameModeTheme {
  icon: React.ReactElement;
  gradient: string;
  accentColor: string;
  badge: string; // small uppercase tag
}
const GAME_MODE_THEMES: Record<GameModeId, GameModeTheme> = {
  'casino-rush': {
    icon: <CasinoIcon />,
    gradient: 'linear-gradient(135deg, #c62828 0%, #ef6c00 100%)',
    accentColor: '#ffd54f',
    badge: '3× OR BUST',
  },
  'slot-machine': {
    icon: <SmartToyIcon />,
    gradient: 'linear-gradient(135deg, #6a1b9a 0%, #d81b60 100%)',
    accentColor: '#ffd700',
    badge: 'SPIN TO WIN',
  },
  'curling': {
    icon: <AcUnitIcon />,
    gradient: 'linear-gradient(135deg, #0d47a1 0%, #1976d2 60%, #64b5f6 100%)',
    accentColor: '#ffffff',
    badge: 'HOLD · SWEEP',
  },
  'tetris': {
    icon: <GamepadIcon />,
    gradient: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 60%, #ce93d8 100%)',
    accentColor: '#e1bee7',
    badge: '60s BLOCKS',
  },
};

export interface CategorySelectProps {
  onSelect: (category: string) => void;
  recentSelections: { category: string; timestamp: string; isCustom?: boolean }[];
  isCatchingUp?: boolean;
  catchupBehind?: number;
  onCreateCustomCategory?: () => void;
  viewOnly?: boolean;
}

const ICONS: Record<string, React.ReactElement> = {
  'History & Politics': <HistoryIcon />,
  'Science & Nature': <ScienceIcon />,
  'Geography & Travel': <PublicIcon />,
  'Pop Culture': <MovieIcon />,
  'Sports & Games': <SportsSoccerIcon />,
  'Literature & Arts': <MenuBookIcon />,
  'Fun Facts & Oddities': <EmojiObjectsIcon />,
  'Rochester, NY': <PlaceIcon />,
  'Food & Drink': <LocalBarIcon />,
  'Family Histories': <FamilyRestroomIcon />,
  'Brooklyn, NY': <LocationCityIcon />,
  'Capital Region, NY': <PlaceIcon />,
  _default: <EmojiObjectsIcon />,
  _custom: <StarsIcon />,
};

const CategorySelect: React.FC<CategorySelectProps> = (props) => {
  const {
    onSelect, recentSelections, isCatchingUp = false, catchupBehind = 0,
    onCreateCustomCategory, viewOnly = false,
  } = props;

  // Countdown to next question (midnight ET)
  const calcCountdown = () => {
    const remaining = 24 * 60 * 60 - getSecondsElapsedTodayET();
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };
  const [countdown, setCountdown] = React.useState(calcCountdown);
  React.useEffect(() => {
    if (!viewOnly) return;
    const id = setInterval(() => setCountdown(calcCountdown()), 30000);
    return () => clearInterval(id);
  }, [viewOnly]);

  const { slotMachine, casinoRush, curling, tetris } = useTrivia();
  const { initCategories, initUserCategories, appInitComplete } = useFamilyData();
  const { globalCategoryStats } = useLeaderboard();

  const theme = useTheme();

  const systemCategories: SystemCategory[] = (initCategories as SystemCategory[]) || [];
  const customCategory: CustomCategory | null =
    Array.isArray(initUserCategories) && initUserCategories.length > 0
      ? (initUserCategories[initUserCategories.length - 1] as CustomCategory)
      : null;

  const loading = !appInitComplete;

  // Lock calculations
  const [now] = React.useState(() => Date.now());
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const customCategoryMs = 3 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - weekMs;
  const threeDaysAgo = now - customCategoryMs;

  const getLockInfo = (catName: string, isCustom = false) => {
    const cooldownPeriod = isCustom ? threeDaysAgo : sevenDaysAgo;
    const picks = recentSelections
      .filter((s) => s.category === catName)
      .map((s) => Date.parse(s.timestamp))
      .filter((ts) => ts > cooldownPeriod)
      .sort((a, b) => a - b);

    const BASE_LIMIT = isCustom ? 1 : 2;
    const extraPicks = isCustom ? 0 : Math.floor(catchupBehind / 5);
    const limit = BASE_LIMIT + extraPicks;

    if (picks.length < limit) return { locked: false as const };

    const earliestRelevant = picks[picks.length - limit];
    const cooldownMs = isCustom ? customCategoryMs : weekMs;
    const lockedUntil = earliestRelevant + cooldownMs;
    const hoursRemaining = Math.ceil((lockedUntil - now) / (1000 * 60 * 60));
    const daysRemaining = Math.ceil(hoursRemaining / 24);
    return { locked: lockedUntil > now, lockedUntil, hoursRemaining, daysRemaining };
  };

  // Category pick counts — all-time
  const getMyPickCount = (catName: string) =>
    recentSelections.filter((s) => s.category === catName).length;

  const formatEastern = (ts: number) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      hour12: true, timeZone: 'America/New_York',
    }).format(new Date(ts));

  const getIcon = (name: string, isCustom = false) =>
    isCustom ? ICONS['_custom'] : (ICONS[name] || ICONS['_default']);

  // Game mode lookup: map registry id → status from context
  const gameModeStatus = {
    'casino-rush': casinoRush,
    'slot-machine': slotMachine,
    'curling': curling,
    'tetris': tetris,
  } as const;

  // Compute "when does today reset" — used as lockedUntil when viewOnly
  // forces all tiles to locked (because the user has no plays left today).
  const getMidnightETMs = () => {
    const now = new Date();
    const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const midnight = new Date(etNow);
    midnight.setHours(24, 0, 0, 0);
    const offsetMs = now.getTime() - etNow.getTime();
    return midnight.getTime() + offsetMs;
  };

  const getGameModeLockInfo = (modeId: GameModeId) => {
    const status = gameModeStatus[modeId];
    // viewOnly means the user can't play anything right now — force locked
    // so the UI doesn't lie about what's clickable.
    if (viewOnly) {
      return { locked: true, lockedUntil: getMidnightETMs() };
    }
    return {
      locked: !(status?.canPlay ?? false),
      lockedUntil: status?.nextAvailable ? status.nextAvailable.getTime() : undefined,
    };
  };

  const enabledGameModes = GAME_MODES.filter(m => ENABLED_MODES[m.id]);
  const hasAnyGameMode = enabledGameModes.length > 0;
  const gameModeScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollGameModes = (dir: 'left' | 'right') => {
    if (!gameModeScrollRef.current) return;
    const el = gameModeScrollRef.current;
    const cardWidth = el.offsetWidth * 0.85; // ~one tile width
    el.scrollBy({ left: dir === 'right' ? cardWidth : -cardWidth, behavior: 'smooth' });
  };

  const hasContent = !loading && systemCategories.length > 0;

  return (
    <Card sx={{
      mb: 2, overflow: 'hidden', borderRadius: 3,
      border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
      boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,
    }}>
      {/* ── Catch-up banner (only when catching up) ────────── */}
      {isCatchingUp && catchupBehind > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
          px: 2, py: 0.75,
          bgcolor: alpha(theme.palette.warning.main, 0.08),
          borderBottom: `1px solid ${alpha(theme.palette.warning.main, 0.12)}`,
        }}>
          <DirectionsRunIcon sx={{ fontSize: 16, color: theme.palette.warning.dark }} />
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: theme.palette.warning.dark }}>
            Catching up — {catchupBehind} question{catchupBehind !== 1 ? 's' : ''} remaining
          </Typography>
        </Box>
      )}

      {/* ── Card header ────────────��───────────────────────── */}
      <Box sx={{
        px: 2, py: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.06)}, transparent)`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: theme.palette.text.primary }}>
          {viewOnly ? 'Your Categories' : 'What do you want to play?'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {viewOnly && (
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: '14px !important' }} />}
              label={countdown}
              size="small"
              sx={{
                height: 22, fontSize: '0.65rem', fontWeight: 700,
                fontFamily: 'monospace',
                bgcolor: alpha(theme.palette.primary.main, 0.1),
                color: theme.palette.primary.main,
              }}
            />
          )}
          {onCreateCustomCategory && !viewOnly && (
            <Tooltip title="Create custom category" placement="left">
              <IconButton size="small" onClick={onCreateCustomCategory}
                sx={{ color: theme.palette.text.secondary, '&:hover': { color: theme.palette.primary.main } }}>
                <AddIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {loading && <LoadingDots mt={4} />}

      {hasContent && (
        <>
          {/* ── Special Challenges section ──────────────────── */}
          {hasAnyGameMode && (
            <>
              <Box sx={{
                px: 2, pt: 1.25, pb: 0.5,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <CasinoIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />
                  <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', color: theme.palette.error.main, letterSpacing: 0.3, textTransform: 'uppercase' }}>
                    Special Challenges
                  </Typography>
                </Box>
                {enabledGameModes.length > 1 && (
                  <Box sx={{ display: 'flex', gap: 0.25 }}>
                    <IconButton size="small" onClick={() => scrollGameModes('left')}
                      sx={{ width: 26, height: 26, color: 'text.secondary', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                      <ChevronLeftIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => scrollGameModes('right')}
                      sx={{ width: 26, height: 26, color: 'text.secondary', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) } }}>
                      <ChevronRightIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
              <Box ref={gameModeScrollRef} sx={{
                display: 'flex', overflowX: 'auto',
                scrollSnapType: 'x mandatory',
                scrollPaddingLeft: 16,
                WebkitOverflowScrolling: 'touch',
                '&::-webkit-scrollbar': { display: 'none' },
                scrollbarWidth: 'none',
                py: 1, pl: 2, pr: 1.25, gap: 1,
              }}>
                {enabledGameModes.map(mode => (
                  <GameModeTile
                    key={mode.id}
                    mode={mode}
                    theme={GAME_MODE_THEMES[mode.id]}
                    lockInfo={getGameModeLockInfo(mode.id)}
                    formatEastern={formatEastern}
                    onSelect={viewOnly ? () => {} : onSelect}
                    disabled={viewOnly}
                    isSingle={enabledGameModes.length === 1}
                  />
                ))}
              </Box>
            </>
          )}

          {/* ── Categories section ─────────────────────────── */}
          <Box sx={{
            px: 2, pt: hasAnyGameMode ? 0.75 : 1.25, pb: 0.5,
            display: 'flex', alignItems: 'center', gap: 0.75,
            ...(hasAnyGameMode && { borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}` }),
          }}>
            <EmojiObjectsIcon sx={{ fontSize: 16, color: theme.palette.primary.main }} />
            <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', color: theme.palette.primary.main, letterSpacing: 0.3, textTransform: 'uppercase' }}>
              {viewOnly ? 'Categories' : 'Pick a Category'}
            </Typography>
          </Box>

          <Box sx={{ px: { xs: 1.25, sm: 1.5 }, pb: 1.5 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
              {customCategory && (
                <CategoryTile
                  name={customCategory.title}
                  lockInfo={getLockInfo(customCategory.title, true)}
                  onSelect={viewOnly ? () => {} : onSelect}
                  theme={theme}
                  icon={getIcon(customCategory.title, true)}
                  tooltip={customCategory.description}
                  accent="secondary"
                  disabled={viewOnly}
                  myPicks={getMyPickCount(customCategory.title)}
                  categoryStats={globalCategoryStats[customCategory.title]}
                  isCustom
                  formatEastern={formatEastern}
                />
              )}
              {[...systemCategories]
                .sort((a, b) => {
                  const LOCAL_ORDER = ['Rochester, NY', 'Brooklyn, NY', 'Capital Region, NY'];
                  const aIdx = LOCAL_ORDER.indexOf(a.name);
                  const bIdx = LOCAL_ORDER.indexOf(b.name);
                  return (aIdx >= 0 ? aIdx : 100) - (bIdx >= 0 ? bIdx : 100);
                })
                .filter(cat => cat?.name)
                .map((cat) => {
                  const LOCAL = ['Rochester, NY', 'Brooklyn, NY', 'Capital Region, NY'];
                  return (
                    <CategoryTile
                      key={cat.name}
                      name={cat.name}
                      lockInfo={getLockInfo(cat.name)}
                      onSelect={viewOnly ? () => {} : onSelect}
                      theme={theme}
                      icon={getIcon(cat.name)}
                      tooltip={cat.description}
                      accent={LOCAL.includes(cat.name) ? 'local' : undefined}
                      disabled={viewOnly}
                      myPicks={getMyPickCount(cat.name)}
                      categoryStats={globalCategoryStats[cat.name]}
                      formatEastern={formatEastern}
                    />
                  );
                })}
            </Box>
          </Box>
        </>
      )}
    </Card>
  );
};

// ── Game mode tile (horizontal scroll) ──────────────────────────
// Rich tile with gradient background, badge, description. Tiles size
// so the next one peeks (when 2+) — a clear affordance for swipe.

interface GameModeTileProps {
  mode: { id: GameModeId; label: string; description: string };
  theme: GameModeTheme;
  lockInfo: { locked: boolean; lockedUntil?: number };
  formatEastern: (ts: number) => string;
  onSelect: (category: string) => void;
  disabled?: boolean;
  isSingle?: boolean;
}

const GameModeTile: React.FC<GameModeTileProps> = ({
  mode, theme, lockInfo, formatEastern, onSelect, disabled = false, isSingle = false,
}) => {
  const muiTheme = useTheme();
  const { locked, lockedUntil } = lockInfo;
  const isDisabled = locked || disabled;
  const [nowTs] = React.useState(() => Date.now());

  const cooldownLabel = locked && lockedUntil ? (() => {
    const hoursRemaining = Math.ceil((lockedUntil - nowTs) / (1000 * 60 * 60));
    if (hoursRemaining <= 1) return 'Ready soon';
    if (hoursRemaining <= 24) return `${hoursRemaining}h left`;
    const days = Math.ceil(hoursRemaining / 24);
    return `${days}d left`;
  })() : null;

  return (
    <Box
      onClick={() => !isDisabled && onSelect(mode.label)}
      sx={{
        position: 'relative',
        flex: isSingle ? '1 1 100%' : '0 0 46%',
        minWidth: isSingle ? 'auto' : '46%',
        scrollSnapAlign: 'start',
        cursor: isDisabled ? 'default' : 'pointer',
        borderRadius: 2.5,
        overflow: 'hidden',
        minHeight: 90,
        p: 1.25,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: locked
          ? `linear-gradient(135deg, ${alpha(muiTheme.palette.action.disabledBackground, 0.4)}, ${alpha(muiTheme.palette.action.disabled, 0.2)})`
          : theme.gradient,
        color: '#fff',
        boxShadow: locked ? 'none' : `0 4px 14px ${alpha('#000', 0.18)}`,
        transition: 'transform 160ms ease, box-shadow 160ms ease',
        opacity: locked ? 0.55 : 1,
        '@media (hover: hover)': {
          '&:hover': isDisabled ? {} : {
            transform: 'translateY(-2px)',
            boxShadow: `0 6px 20px ${alpha('#000', 0.28)}`,
          },
        },
        '&:active': isDisabled ? {} : { transform: 'translateY(0)' },
      }}
    >
      {/* Decorative icon watermark */}
      <Box sx={{
        position: 'absolute', right: -8, bottom: -10, pointerEvents: 'none',
        opacity: locked ? 0.06 : 0.14,
        '& .MuiSvgIcon-root': { fontSize: 80 },
      }}>
        {React.cloneElement(theme.icon)}
      </Box>

      {/* Top row: icon + badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, zIndex: 1 }}>
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: '50%',
          bgcolor: alpha('#fff', 0.22),
          backdropFilter: 'blur(4px)',
          '& .MuiSvgIcon-root': { fontSize: '0.95rem', color: '#fff' },
        }}>
          {locked ? <LockIcon /> : theme.icon}
        </Box>
        {!locked && (
          <Box sx={{
            fontSize: '0.48rem', fontWeight: 800, letterSpacing: 0.5,
            px: 0.6, py: 0.2, borderRadius: 0.75,
            bgcolor: alpha('#000', 0.25),
            color: theme.accentColor,
            lineHeight: 1,
          }}>
            {theme.badge}
          </Box>
        )}
      </Box>

      {/* Label + description */}
      <Box sx={{ zIndex: 1, mt: 0.5 }}>
        <Typography sx={{
          fontWeight: 800, fontSize: '0.85rem', lineHeight: 1.15,
          textShadow: `0 1px 2px ${alpha('#000', 0.25)}`,
        }}>
          {mode.label}
        </Typography>
        <Typography sx={{
          fontSize: '0.58rem', fontWeight: 500, lineHeight: 1.25,
          opacity: 0.88, mt: 0.15,
          textShadow: `0 1px 2px ${alpha('#000', 0.2)}`,
        }}>
          {mode.description}
        </Typography>
      </Box>

      {/* Bottom: play CTA or cooldown */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mt: 0.5, zIndex: 1,
      }}>
        {locked ? (
          <Tooltip title={lockedUntil ? formatEastern(lockedUntil) : ''} placement="top">
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.3,
              fontSize: '0.58rem', fontWeight: 700,
              color: alpha('#fff', 0.85),
            }}>
              <AccessTimeIcon sx={{ fontSize: '0.7rem' }} />
              {cooldownLabel ?? 'Locked'}
            </Box>
          </Tooltip>
        ) : (
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.25,
            fontSize: '0.58rem', fontWeight: 800, letterSpacing: 0.4,
            color: '#fff', textTransform: 'uppercase',
          }}>
            Play now
            <PlayArrowIcon sx={{ fontSize: '0.8rem' }} />
          </Box>
        )}
      </Box>
    </Box>
  );
};

// ── Category tile ───────────────────────────────────────────────

// ── Category accuracy helpers ──────────────────────────────────

const MIN_ANSWERS_FOR_BONUS = 10;
const HARD_BONUS_THRESHOLD = 0.4;   // <40% accuracy → +1 bonus
const MEDIUM_BONUS_THRESHOLD = 0.6; // <60% accuracy → +0.5 bonus

function getCategoryBonus(stats?: { total: number; correct: number }): { bonus: number; label: string } | null {
  if (!stats || stats.total < MIN_ANSWERS_FOR_BONUS) return null;
  const accuracy = stats.correct / stats.total;
  if (accuracy < HARD_BONUS_THRESHOLD) return { bonus: 2, label: '+2pts' };
  if (accuracy < MEDIUM_BONUS_THRESHOLD) return { bonus: 1, label: '+1pt' };
  return null;
}

function getAccuracyColor(pct: number, theme: import('@mui/material/styles').Theme): string {
  if (pct < 40) return theme.palette.error.main;
  if (pct < 60) return theme.palette.warning.main;
  return theme.palette.success.main;
}

// ── Category tile ───────────────────────────────────────────────

interface CategoryTileProps {
  name: string;
  lockInfo: { locked: boolean; lockedUntil?: number; hoursRemaining?: number; daysRemaining?: number };
  onSelect: (category: string) => void;
  theme: import('@mui/material/styles').Theme;
  icon: React.ReactElement;
  tooltip?: string;
  accent?: 'secondary' | 'local';
  disabled?: boolean;
  myPicks: number;
  categoryStats?: { total: number; correct: number };
  isCustom?: boolean;
  formatEastern: (ts: number) => string;
}

const CategoryTile: React.FC<CategoryTileProps> = ({
  name, lockInfo, onSelect, theme, icon, accent, disabled = false,
  myPicks, categoryStats, isCustom = false, formatEastern,
}) => {
  const { locked } = lockInfo;
  const [shouldShake, setShouldShake] = React.useState(false);

  const handleClick = () => {
    if (disabled) return;
    if (locked) {
      setShouldShake(true);
      setTimeout(() => setShouldShake(false), 500);
    } else {
      onSelect(name);
    }
  };

  const accentColor = accent === 'secondary'
    ? theme.palette.secondary.main
    : accent === 'local' ? '#455A64' : theme.palette.primary.main;

  const familyTotal = categoryStats?.total ?? 0;
  const accuracyPct = familyTotal > 0
    ? Math.round((categoryStats!.correct / familyTotal) * 100)
    : null;
  const bonusInfo = !isCustom ? getCategoryBonus(categoryStats) : null;

  return (
    <Box
      onClick={handleClick}
      sx={{
        position: 'relative',
        cursor: disabled ? 'default' : locked ? 'not-allowed' : 'pointer',
        // Disabled (viewOnly) greys the tile out so it doesn't look clickable
        // when the user can't play anything right now.
        opacity: locked || disabled ? 0.45 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        transition: 'all 0.2s ease',
        borderRadius: 2,
        border: `1px solid ${alpha(
          locked || disabled ? theme.palette.divider : bonusInfo ? theme.palette.warning.main : accentColor,
          locked || disabled ? 0.08 : bonusInfo ? 0.3 : accent ? 0.2 : 0.12,
        )}`,
        background: locked || disabled
          ? alpha(theme.palette.action.disabledBackground, 0.1)
          : bonusInfo
            ? `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.06)}, ${alpha(theme.palette.error.main, 0.03)})`
            : accent ? alpha(accentColor, 0.03) : theme.palette.background.paper,
        p: 1.25,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center',
        minHeight: 80,
        boxShadow: (locked || disabled) ? 'none' : `0 1px 4px ${alpha('#000', 0.04)}`,
        '&:hover': (locked || disabled) ? {} : {
          boxShadow: `0 3px 10px ${alpha('#000', 0.08)}`,
          borderColor: alpha(bonusInfo ? theme.palette.warning.main : accentColor, 0.35),
          transform: 'translateY(-1px)',
        },
        '@keyframes shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-3px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(3px)' },
        },
        ...(shouldShake && { animation: 'shake 0.5s ease-in-out' }),
      }}
    >
      {/* Bonus badge */}
      {bonusInfo && !locked && (
        <Tooltip title={`Tough category! ${bonusInfo.label} bonus point${bonusInfo.bonus > 0.5 ? '' : ''} per correct answer`} placement="top">
          <Box sx={{
            position: 'absolute', top: -6, right: -4,
            display: 'flex', alignItems: 'center', gap: 0.2,
            bgcolor: bonusInfo.bonus >= 1 ? theme.palette.error.main : theme.palette.warning.dark,
            color: '#fff',
            px: 0.5, py: 0.15,
            borderRadius: 1,
            fontSize: '0.55rem', fontWeight: 800,
            lineHeight: 1,
            boxShadow: `0 1px 4px ${alpha('#000', 0.2)}`,
          }}>
            <LocalFireDepartmentIcon sx={{ fontSize: '0.6rem' }} />
            {bonusInfo.label}
          </Box>
        </Tooltip>
      )}

      {/* Icon */}
      <Box sx={{
        color: locked ? theme.palette.text.disabled : accentColor,
        mb: 0.4,
        '& .MuiSvgIcon-root': { fontSize: '1.3rem' },
      }}>
        {locked ? <LockIcon /> : icon}
      </Box>

      {/* Name */}
      <Typography sx={{
        fontSize: '0.72rem', fontWeight: 600, lineHeight: 1.2,
        color: locked ? theme.palette.text.disabled : theme.palette.text.primary,
      }}>
        {name}
      </Typography>

      {/* Lock countdown */}
      {locked && lockInfo.hoursRemaining && lockInfo.hoursRemaining <= 48 && (
        <Tooltip
          title={lockInfo.lockedUntil ? appStrings.lockedUntil(formatEastern(lockInfo.lockedUntil)) : appStrings.lockedGeneric}
          placement="top"
        >
          <Typography sx={{ fontSize: '0.55rem', color: theme.palette.text.disabled, mt: 0.2 }}>
            {lockInfo.hoursRemaining <= 1 ? 'Soon' : lockInfo.hoursRemaining <= 24 ? `${lockInfo.hoursRemaining}h` : `${lockInfo.daysRemaining}d`}
          </Typography>
        </Tooltip>
      )}

      {/* Accuracy bar + stats */}
      {!isCustom && accuracyPct !== null && familyTotal >= 3 && !locked && (
        <Box sx={{ width: '100%', mt: 0.6, px: 0.5 }}>
          {/* Accuracy progress bar */}
          <Box sx={{
            width: '100%', height: 3, borderRadius: 2,
            bgcolor: alpha(theme.palette.divider, 0.12),
            overflow: 'hidden',
          }}>
            <Box sx={{
              width: `${accuracyPct}%`, height: '100%',
              borderRadius: 2,
              bgcolor: getAccuracyColor(accuracyPct, theme),
              transition: 'width 0.4s ease',
            }} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.2 }}>
            <Typography sx={{
              fontSize: '0.52rem', fontWeight: 700,
              color: getAccuracyColor(accuracyPct, theme),
              lineHeight: 1,
            }}>
              {accuracyPct}%
            </Typography>
            <Typography sx={{
              fontSize: '0.52rem', fontWeight: 600,
              color: theme.palette.text.disabled,
              lineHeight: 1,
            }}>
              {familyTotal} ans
            </Typography>
          </Box>
        </Box>
      )}

      {/* Your pick count */}
      {myPicks > 0 && (
        <Typography sx={{
          fontSize: '0.55rem', fontWeight: 700, mt: 0.3,
          color: accentColor,
          bgcolor: alpha(accentColor, 0.1),
          px: 0.6, py: 0.1, borderRadius: 1,
          lineHeight: 1.2,
        }}>
          You: {myPicks}
        </Typography>
      )}
    </Box>
  );
};

export default CategorySelect;
