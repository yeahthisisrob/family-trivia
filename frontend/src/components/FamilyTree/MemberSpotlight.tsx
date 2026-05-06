// File: src/components/FamilyTree/MemberSpotlight.tsx
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun';
import EmojiEmotionsIcon from '@mui/icons-material/EmojiEmotions';
import FavoriteIcon from '@mui/icons-material/Favorite';
import GroupIcon from '@mui/icons-material/Group';
import InfoIcon from '@mui/icons-material/Info';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import PersonIcon from '@mui/icons-material/Person';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Typography,
  IconButton,
  useTheme,
  Switch,
  Fade,
  Skeleton,
  Chip,
  Menu,
  MenuItem,
  Button,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState, useEffect, useCallback, useRef } from 'react';

import { FamilyHierarchy, getMemberSummary } from '../../api';
import { shadows } from '../../shared/design-system/tokens/shadows';
import { spacing } from '../../shared/design-system/tokens/spacing';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

// ── Types ────────────────────────────────────────────────────────────

interface BasicQA {
  question: string;
  answer: string;
}

interface MemberInsight {
  text: string;
  category: 'preference' | 'personality' | 'fact' | 'activity' | 'relationship';
}

interface MemberSummaryResponse {
  userId: string;
  summary: string;
  mode: 'regular' | 'roast';
  lastUpdated: string;
  basicQAs?: BasicQA[];
  insights?: MemberInsight[];
}

interface SummaryState {
  userId: string;
  regularSummary: string;
  roastSummary: string;
  lastUpdated: string;
  loading: boolean;
  error: boolean;
  basicQAs: BasicQA[];
  insights: MemberInsight[];
}

/** Mock summary data for Storybook — keyed by userId */
export interface MockSummary {
  regular: string;
  roast: string;
  basicQAs?: BasicQA[];
  insights?: MemberInsight[];
}

export interface MemberSpotlightProps {
  hierarchy: FamilyHierarchy;
  currentUserId: string;
  onMemberClick: (userId: string) => void;
  /** Test-only: inject mock summaries to bypass the API */
  __mockSummaries?: Record<string, MockSummary>;
}

// ── Constants ────────────────────────────────────────────────────────

const REFRESH_COOLDOWN_MS = 5_000;
const REQUEST_TIMEOUT_MS = 60_000;
const CIRCUIT_BREAKER_THRESHOLD = 4;
const CIRCUIT_RESET_MS = 5 * 60_000;
const INSIGHT_ICONS: Record<string, React.ReactElement> = {
  preference: <FavoriteIcon sx={{ fontSize: 14 }} />,
  personality: <EmojiEmotionsIcon sx={{ fontSize: 14 }} />,
  fact: <InfoIcon sx={{ fontSize: 14 }} />,
  activity: <DirectionsRunIcon sx={{ fontSize: 14 }} />,
  relationship: <GroupIcon sx={{ fontSize: 14 }} />,
};
const DEFAULT_INSIGHT_ICON = <LightbulbIcon sx={{ fontSize: 14 }} />;
const MAX_QAS_SHOWN = 4;

const EMPTY_SUMMARY: SummaryState = {
  userId: '',
  regularSummary: '',
  roastSummary: '',
  lastUpdated: '',
  loading: true,
  error: false,
  basicQAs: [],
  insights: [],
};

// ── Helpers ──────────────────────────────────────────────────────────

function getMemberSideColor(
  userId: string,
  hierarchy: FamilyHierarchy,
  fallback: string,
): string {
  const person = hierarchy.family.people[userId];
  if (!person) return fallback;

  const groupId = person.groupId || '';
  const sides = hierarchy.family.sides || {};

  for (const sideData of Object.values(sides)) {
    if (sideData.groups?.includes(groupId)) return sideData.color || fallback;
  }
  if (person.familySide && sides[person.familySide]) {
    return sides[person.familySide].color || fallback;
  }
  return fallback;
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function timeoutRace<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ── Component ────────────────────────────────────────────────────────

const MemberSpotlight: React.FC<MemberSpotlightProps> = ({
  hierarchy,
  currentUserId,
  onMemberClick,
  __mockSummaries,
}) => {
  const theme = useTheme();
  const logger = createLogger('MemberSpotlight');
  const allMemberIds = Object.keys(hierarchy.family.people);

  // Carousel state
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = allMemberIds.indexOf(currentUserId);
    return idx >= 0 ? idx : 0;
  });
  const [roastMode, setRoastMode] = useState(false);

  // If mocks provided, hydrate initial state from them
  const [summaryData, setSummaryData] = useState<SummaryState>(() => {
    if (!__mockSummaries) return EMPTY_SUMMARY;
    const id = allMemberIds[allMemberIds.indexOf(currentUserId) >= 0 ? allMemberIds.indexOf(currentUserId) : 0];
    const mock = __mockSummaries[id];
    if (!mock) return EMPTY_SUMMARY;
    return {
      userId: id,
      regularSummary: mock.regular,
      roastSummary: mock.roast,
      lastUpdated: new Date().toISOString(),
      loading: false,
      error: false,
      basicQAs: mock.basicQAs || [],
      insights: mock.insights || [],
    };
  });

  // Error / circuit breaker state
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const [apiCircuitBroken, setApiCircuitBroken] = useState(false);
  const errorCountRef = useRef(0);
  const lastErrorRef = useRef<number>(0);
  const loadedRef = useRef<Record<string, { regular: boolean; roast: boolean }>>({});

  // Member menu state
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  // Derived
  const memberId = allMemberIds[currentIndex];
  const member = hierarchy.family.people[memberId];
  const accentColor = getMemberSideColor(memberId, hierarchy, theme.palette.primary.main);

  // ── Data loading ─────────────────────────────────────────────────

  const loadSummary = useCallback(
    async (userId: string, forceGenerate = false, specificMode?: 'regular' | 'roast') => {
      if (!userId) return;
      const mode = specificMode || (roastMode ? 'roast' : 'regular');

      // Skip if already loaded for this user+mode
      if (
        !forceGenerate &&
        summaryData.userId === userId &&
        (mode === 'regular' ? summaryData.regularSummary : summaryData.roastSummary)
      ) {
        return;
      }

      // Circuit breaker check
      if (apiCircuitBroken) {
        setSummaryData((prev) => ({
          ...prev,
          loading: false,
          error: true,
        }));
        return;
      }

      // Exponential backoff after repeated errors
      if (errorCountRef.current > 2 && lastErrorRef.current) {
        const backoff = Math.min(30_000 * 2 ** (errorCountRef.current - 2), CIRCUIT_RESET_MS);
        if (Date.now() - lastErrorRef.current < backoff) {
          setSummaryData((prev) => ({ ...prev, loading: false, error: true }));
          return;
        }
      }

      setSummaryData((prev) => ({ ...prev, loading: true, userId, error: false }));

      try {
        const result = (await timeoutRace(
          getMemberSummary(userId, mode, forceGenerate),
          REQUEST_TIMEOUT_MS,
        )) as MemberSummaryResponse;

        const isReal =
          result?.summary &&
          !['unavailable', 'error', 'failed'].some((w) =>
            result.summary.toLowerCase().includes(w),
          );

        if (isReal) errorCountRef.current = 0;

        setSummaryData((prev) => ({
          ...prev,
          loading: false,
          userId,
          error: !isReal,
          ...(mode === 'regular'
            ? { regularSummary: result.summary || '' }
            : { roastSummary: result.summary || '' }),
          lastUpdated: result.lastUpdated || new Date().toISOString(),
          basicQAs: result.basicQAs || prev.basicQAs,
          insights: result.insights || prev.insights,
        }));
      } catch (err) {
        logger.error(`Error loading ${mode} summary for ${userId}:`, err);
        errorCountRef.current += 1;
        lastErrorRef.current = Date.now();
        if (errorCountRef.current >= CIRCUIT_BREAKER_THRESHOLD) setApiCircuitBroken(true);

        setSummaryData((prev) => ({
          ...prev,
          loading: false,
          error: true,
          userId,
          ...(mode === 'regular'
            ? { regularSummary: prev.regularSummary || '' }
            : { roastSummary: prev.roastSummary || '' }),
        }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [apiCircuitBroken, roastMode],
  );

  // Load on navigate / mode toggle
  useEffect(() => {
    if (!allMemberIds.length || apiCircuitBroken) return;
    const id = allMemberIds[currentIndex];
    const mode = roastMode ? 'roast' : 'regular';

    // If mocks provided, hydrate from them instead of calling the API
    if (__mockSummaries) {
      const mock = __mockSummaries[id];
      if (mock) {
        setSummaryData({
          userId: id,
          regularSummary: mock.regular,
          roastSummary: mock.roast,
          lastUpdated: new Date().toISOString(),
          loading: false,
          error: false,
          basicQAs: mock.basicQAs || [],
          insights: mock.insights || [],
        });
      } else {
        setSummaryData({ ...EMPTY_SUMMARY, userId: id, loading: false, error: true });
      }
      return;
    }

    if (!loadedRef.current[id]) loadedRef.current[id] = { regular: false, roast: false };
    if (!loadedRef.current[id][mode]) {
      loadSummary(id, false, mode);
      loadedRef.current[id][mode] = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, roastMode, apiCircuitBroken]);

  // Reset circuit breaker after 5 min
  useEffect(() => {
    if (!apiCircuitBroken) return;
    const timer = setTimeout(() => {
      setApiCircuitBroken(false);
      errorCountRef.current = 0;
    }, CIRCUIT_RESET_MS);
    return () => clearTimeout(timer);
  }, [apiCircuitBroken]);

  // ── Actions ──────────────────────────────────────────────────────

  const navigate = (dir: 'next' | 'prev') =>
    setCurrentIndex((i) =>
      dir === 'next' ? (i + 1) % allMemberIds.length : i === 0 ? allMemberIds.length - 1 : i - 1,
    );

  const refresh = () => {
    if (refreshCooldown || apiCircuitBroken) return;
    setRefreshCooldown(true);
    loadSummary(memberId, true, roastMode ? 'roast' : 'regular');
    setTimeout(() => setRefreshCooldown(false), REFRESH_COOLDOWN_MS);
  };

  const toggleMode = () => {
    const newMode = !roastMode;
    setRoastMode(newMode);
    const modeStr = newMode ? 'roast' : 'regular';
    const hasData = newMode ? summaryData.roastSummary : summaryData.regularSummary;
    if (!hasData && memberId) loadSummary(memberId, false, modeStr);
  };

  // ── Render guards ────────────────────────────────────────────────

  if (!member || !allMemberIds.length) return null;

  return (
    <Box sx={{ mb: `${spacing.lg}px` }}>
      <Box
        sx={{
          borderRadius: `${12}px`,
          border: `1px solid ${alpha(accentColor, 0.2)}`,
          borderTop: `3px solid ${accentColor}`,
          bgcolor: 'background.paper',
          boxShadow: shadows.card,
          overflow: 'hidden',
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <Box
          sx={{
            px: `${spacing.cardPadding.xs}px`,
            pt: `${spacing.cardPadding.xs}px`,
            pb: 1,
            background: `linear-gradient(135deg, ${alpha(accentColor, 0.06)}, transparent)`,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AutoAwesomeIcon sx={{ color: accentColor, fontSize: 16 }} />
              <Typography
                variant="caption"
                sx={{ fontWeight: 600, color: accentColor, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.65rem' }}
              >
                Member Spotlight
              </Typography>
            </Box>

            {/* Roast toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                Normal
              </Typography>
              <Switch
                size="small"
                checked={roastMode}
                onChange={toggleMode}
                color="warning"
                sx={{ mx: -0.5 }}
              />
              <EmojiEmotionsIcon
                sx={{ fontSize: 14, color: roastMode ? 'warning.main' : 'text.disabled', mr: 0.25 }}
              />
              <Typography variant="caption" sx={{ fontSize: '0.65rem', color: roastMode ? 'warning.main' : 'text.secondary' }}>
                Roast
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ── Member picker (carousel + dropdown) ─────────────── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 1,
            py: 0.75,
          }}
        >
          <IconButton
            size="small"
            onClick={() => navigate('prev')}
            sx={{
              color: accentColor,
              bgcolor: alpha(accentColor, 0.08),
              '&:hover': { bgcolor: alpha(accentColor, 0.16) },
              width: 32,
              height: 32,
            }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>

          <Box sx={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
            <Button
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '16px !important' }} />}
              sx={{
                borderRadius: 2,
                px: 1.5,
                py: 0.25,
                minHeight: 0,
                textTransform: 'none',
                '&:hover': { bgcolor: alpha(accentColor, 0.08) },
              }}
            >
              <Typography sx={{ fontWeight: 700, color: accentColor, fontSize: '1.05rem' }}>
                {member.name}
              </Typography>
            </Button>

            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
              transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              slotProps={{ paper: { elevation: 3, sx: { maxHeight: 300, width: 220 } } }}
            >
              {Object.entries(hierarchy.family.groups).map(([groupId, group]) => {
                if (!group.members?.length) return null;
                const sorted = [...group.members].sort((a, b) =>
                  (hierarchy.family.people[a]?.name || '').localeCompare(
                    hierarchy.family.people[b]?.name || '',
                  ),
                );
                return (
                  <React.Fragment key={groupId}>
                    <Box
                      sx={{
                        px: 2,
                        py: 0.5,
                        bgcolor: alpha(accentColor, 0.04),
                        borderBottom: `1px solid ${alpha(accentColor, 0.08)}`,
                      }}
                    >
                      <Typography variant="caption" fontWeight={700} color="text.secondary">
                        {group.name}
                      </Typography>
                    </Box>
                    {sorted.map((mId) => {
                      const p = hierarchy.family.people[mId];
                      if (!p) return null;
                      const idx = allMemberIds.indexOf(mId);
                      const selected = mId === memberId;
                      return (
                        <MenuItem
                          key={mId}
                          selected={selected}
                          onClick={() => {
                            setCurrentIndex(idx);
                            setMenuAnchor(null);
                          }}
                          sx={{
                            px: 1.5,
                            py: 0.5,
                            minHeight: 36,
                            '&.Mui-selected': { bgcolor: alpha(accentColor, 0.08) },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28 }}>
                            <PersonIcon
                              sx={{ fontSize: 18, color: selected ? accentColor : 'text.secondary' }}
                            />
                          </ListItemIcon>
                          <ListItemText
                            primary={p.name}
                            primaryTypographyProps={{
                              variant: 'body2',
                              fontWeight: selected ? 700 : 400,
                              color: selected ? accentColor : 'text.primary',
                              fontSize: '0.8rem',
                            }}
                          />
                        </MenuItem>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </Menu>

            <Chip
              label={member.groupId || 'Family Member'}
              size="small"
              onClick={() => onMemberClick(memberId)}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: alpha(accentColor, 0.08),
                color: 'text.secondary',
                cursor: 'pointer',
                '&:hover': { bgcolor: alpha(accentColor, 0.16) },
              }}
            />
          </Box>

          <IconButton
            size="small"
            onClick={() => navigate('next')}
            sx={{
              color: accentColor,
              bgcolor: alpha(accentColor, 0.08),
              '&:hover': { bgcolor: alpha(accentColor, 0.16) },
              width: 32,
              height: 32,
            }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── Summary body ────────────────────────────────────── */}
        <Box sx={{ px: `${spacing.cardPadding.xs}px`, pb: 1, minHeight: 80 }}>
          {summaryData.loading ? (
            <Box sx={{ py: 1 }}>
              <Skeleton variant="text" width="100%" height={18} />
              <Skeleton variant="text" width="92%" height={18} />
              <Skeleton variant="text" width="85%" height={18} />
              <Skeleton variant="text" width="60%" height={18} />
            </Box>
          ) : summaryData.error ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Spotlight coming soon for {member.name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                Still collecting data
              </Typography>
              {apiCircuitBroken && (
                <Chip label="Temporarily unavailable" size="small" color="warning" sx={{ mt: 1, height: 22, fontSize: '0.6rem' }} />
              )}
              <IconButton
                size="small"
                onClick={refresh}
                disabled={refreshCooldown}
                sx={{ mt: 1, bgcolor: alpha(accentColor, 0.08) }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ) : (
            <>
              <Fade in={!roastMode} timeout={300}>
                <Box sx={{ display: roastMode ? 'none' : 'block', py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                    {summaryData.regularSummary}
                  </Typography>
                </Box>
              </Fade>
              <Fade in={roastMode} timeout={300}>
                <Box sx={{ display: !roastMode ? 'none' : 'block', py: 0.5 }}>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.8rem', lineHeight: 1.5, fontStyle: 'italic', color: 'warning.dark' }}
                  >
                    {summaryData.roastSummary}
                  </Typography>
                </Box>
              </Fade>
            </>
          )}
        </Box>

        {/* ── Quick facts (insights chips) ────────────────────── */}
        {!summaryData.loading && !summaryData.error && summaryData.insights.length > 0 && (
          <Box sx={{ px: `${spacing.cardPadding.xs}px`, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <AutoAwesomeIcon sx={{ fontSize: 13, color: accentColor }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: accentColor, fontSize: '0.65rem' }}>
                Quick Facts
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: `${spacing.chipGap}px` }}>
              {summaryData.insights.map((insight, i) => (
                <Chip
                  key={i}
                  icon={INSIGHT_ICONS[insight.category] || DEFAULT_INSIGHT_ICON}
                  label={insight.text}
                  size="small"
                  sx={{
                    height: 24,
                    fontSize: '0.7rem',
                    bgcolor: alpha(accentColor, 0.08),
                    '& .MuiChip-icon': { color: accentColor, fontSize: 14 },
                    '&:hover': { bgcolor: alpha(accentColor, 0.14) },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* ── Q&A highlights ──────────────────────────────────── */}
        {!summaryData.loading && !summaryData.error && summaryData.basicQAs.length > 0 && (
          <Box sx={{ px: `${spacing.cardPadding.xs}px`, pb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
              <QuestionAnswerIcon sx={{ fontSize: 13, color: accentColor }} />
              <Typography variant="caption" sx={{ fontWeight: 600, color: accentColor, fontSize: '0.65rem' }}>
                Q&A Highlights
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {summaryData.basicQAs.slice(0, MAX_QAS_SHOWN).map((qa, i) => (
                <Box
                  key={i}
                  sx={{
                    p: 1,
                    borderRadius: `${8}px`,
                    bgcolor: alpha(accentColor, 0.03),
                    border: `1px solid ${alpha(accentColor, 0.08)}`,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem', display: 'block', mb: 0.25 }}>
                    {qa.question}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.78rem' }}>
                    {qa.answer}
                  </Typography>
                </Box>
              ))}
              {summaryData.basicQAs.length > MAX_QAS_SHOWN && (
                <Typography
                  variant="caption"
                  sx={{ textAlign: 'center', color: accentColor, fontStyle: 'italic', fontSize: '0.65rem', mt: 0.25 }}
                >
                  +{summaryData.basicQAs.length - MAX_QAS_SHOWN} more
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {/* ── Footer ──────────────────────────────────────────── */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: `${spacing.cardPadding.xs}px`,
            py: 0.75,
            borderTop: `1px solid ${alpha(accentColor, 0.08)}`,
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
            {summaryData.lastUpdated ? `Updated ${formatDate(summaryData.lastUpdated)}` : ''}
          </Typography>
          <IconButton
            size="small"
            onClick={refresh}
            disabled={summaryData.loading || refreshCooldown || apiCircuitBroken}
            sx={{
              width: 28,
              height: 28,
              color: 'text.secondary',
              '&:hover': { bgcolor: alpha(accentColor, 0.08), color: accentColor },
            }}
          >
            {summaryData.loading ? (
              <LoadingDots size={3} inline />
            ) : (
              <RefreshIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
};

export default MemberSpotlight;
