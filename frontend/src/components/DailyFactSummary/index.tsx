// File: src/components/DailyFactSummary/index.tsx
import { convertToEasternTime } from '@family-trivia/shared';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import GroupsIcon from '@mui/icons-material/Groups';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Card,
  Collapse,
  Paper,
  Typography,
  IconButton,
  useTheme,
  alpha,
  Fade,
  Skeleton,
  Chip,
  Menu,
  MenuItem,
  Button,
  LinearProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
} from '@mui/material';
import React, { useState, useEffect, useCallback, useMemo } from 'react';

import {
  getDailyFactSummary,
  type DailyFactSummary as DailyFactSummaryType,
} from '../../api/modules/timeline';
import { useFamilyData } from '../../contexts/FamilyDataContext';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

interface DailyFactSummaryProps {
  onDateChange?: (date: string) => void;
  onUserClick?: (userId: string) => void;
}

interface DateOption {
  value: string;
  label: string;
  isYesterday?: boolean;
  isThisWeek?: boolean;
  isWeekly: boolean;
}

const DailyFactSummary: React.FC<DailyFactSummaryProps> = ({ onDateChange, onUserClick }) => {
  const theme = useTheme();
  const logger = createLogger('DailyFactSummary');
  const { hierarchyData } = useFamilyData();
  const [expanded, setExpanded] = useState(false);

  // Format date as YYYY-MM-DD
  const formatDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Calculate yesterday as default date (in Eastern Time)
  const getYesterdayDate = () => {
    const nowET = convertToEasternTime(new Date());
    const yesterdayET = new Date(nowET);
    yesterdayET.setDate(yesterdayET.getDate() - 1);
    return formatDateString(yesterdayET);
  };

  // Store yesterday's date as a constant
  const yesterdayDate = getYesterdayDate();

  // Get the Sunday of the current week (for weekly facts)
  const getCurrentWeekStart = () => {
    const nowET = convertToEasternTime(new Date());
    const dayOfWeek = nowET.getDay();
    const weekStart = new Date(nowET);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    return formatDateString(weekStart);
  };

  // Check if a date is after the weekly system started (e.g., Jan 26, 2025)
  const isWeeklySystem = (dateString: string) => {
    // You can adjust this date based on when you want to start the weekly system
    const weeklySystemStartDate = '2025-01-26'; // Sunday, Jan 26, 2025
    return dateString >= weeklySystemStartDate;
  };

  // Get the Sunday of a given date's week
  const getWeekStartForDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - dayOfWeek);
    return formatDateString(weekStart);
  };

  // Get last week's start date (for weekly summaries default)
  const getLastWeekStart = () => {
    const nowET = convertToEasternTime(new Date());
    const dayOfWeek = nowET.getDay();
    const lastWeek = new Date(nowET);
    lastWeek.setDate(lastWeek.getDate() - dayOfWeek - 7); // Go to last Sunday
    return formatDateString(lastWeek);
  };

  // State for date navigation
  // If we're in the weekly system, default to last week (completed week)
  const defaultDate = isWeeklySystem(yesterdayDate) ? getLastWeekStart() : yesterdayDate;
  const [currentDate, setCurrentDate] = useState(defaultDate);
  const [isWeeklyView, setIsWeeklyView] = useState(isWeeklySystem(defaultDate));
  const [summaryData, setSummaryData] = useState<DailyFactSummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);

  // State for date dropdown
  const [dateMenuAnchor, setDateMenuAnchor] = useState<null | HTMLElement>(null);
  const openDateMenu = Boolean(dateMenuAnchor);

  // State for questions dialog
  const [questionsDialogOpen, setQuestionsDialogOpen] = useState(false);

  // Generate list of available dates (last 30 days)
  const getAvailableDates = (): DateOption[] => {
    const dates: DateOption[] = [];
    const today = new Date();
    const processedWeeks = new Set<string>();

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDateString(date);

      if (isWeeklySystem(dateStr)) {
        // For weekly system, group by week
        const weekStart = getWeekStartForDate(dateStr);

        // Skip if we've already added this week
        if (processedWeeks.has(weekStart)) {
          continue;
        }
        processedWeeks.add(weekStart);

        const weekStartDate = new Date(weekStart);
        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekEndDate.getDate() + 6);

        dates.push({
          value: weekStart,
          label: `Week of ${weekStartDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}`,
          isThisWeek: weekStart === getCurrentWeekStart(),
          isWeekly: true,
        });
      } else {
        // For daily system, show individual days
        dates.push({
          value: dateStr,
          label: date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
          isYesterday: i === 1,
          isWeekly: false,
        });
      }
    }

    return dates;
  };

  // Load summary for current date
  const loadSummary = useCallback(
    async (date: string, forceRefresh = false) => {
      setLoading(true);
      setError(null);

      try {
        const isWeekly = isWeeklySystem(date);
        logger.info(`Loading ${isWeekly ? 'weekly' : 'daily'} fact summary`, {
          date,
          forceRefresh,
          isWeekly,
        });
        const summary = await getDailyFactSummary(date, forceRefresh, isWeekly);
        setSummaryData(summary);
        logger.info(`${isWeekly ? 'Weekly' : 'Daily'} fact summary loaded`, {
          date,
          totalResponses: summary.totalResponses,
          summary: summary.summary.substring(0, 100) + '...',
          factType: summary.factType,
          totalQuestions: summary.totalQuestions,
          uniqueParticipants: summary.uniqueParticipants,
          isNewlyGenerated: summary.isNewlyGenerated,
        });

        // If this was newly generated, we already have the data - no need to refresh
        // The backend already saved it to cache and returned the complete data
        if (summary.isNewlyGenerated) {
          logger.info('Summary was newly generated and is now displayed');
        }
      } catch (err: unknown) {
        logger.error(`Error loading ${isWeeklyView ? 'weekly' : 'daily'} fact summary`, {
          date,
          error: err instanceof Error ? err.message : String(err),
        });
        setError('Failed to load summary. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isWeeklyView],
  );

  // Load summary when date changes (deferred on initial mount to avoid blocking render)
  const isInitialMount = React.useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      const timer = setTimeout(() => {
        loadSummary(currentDate);
        if (onDateChange) {
          onDateChange(currentDate);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    loadSummary(currentDate);
    if (onDateChange) {
      onDateChange(currentDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, isWeeklyView]);

  // Navigation functions
  const navigateDate = (direction: 'prev' | 'next') => {
    const [year, month, day] = currentDate.split('-').map(Number);
    const current = new Date(year, month - 1, day);

    if (isWeeklyView) {
      // Navigate by week
      if (direction === 'prev') {
        current.setDate(current.getDate() - 7);
      } else {
        current.setDate(current.getDate() + 7);
        // Don't go beyond current week
        const nextWeekStr = formatDateString(current);
        if (nextWeekStr > getCurrentWeekStart()) {
          return;
        }
      }
    } else {
      // Navigate by day
      if (direction === 'prev') {
        current.setDate(current.getDate() - 1);
      } else {
        current.setDate(current.getDate() + 1);
        // Don't go beyond yesterday
        const nextDateStr = formatDateString(current);
        if (nextDateStr > yesterdayDate) {
          return;
        }
      }
    }

    // Format as YYYY-MM-DD
    const newDateStr = formatDateString(current);
    setCurrentDate(newDateStr);

    // Update weekly view state based on the new date
    setIsWeeklyView(isWeeklySystem(newDateStr));
  };

  // Date dropdown handlers
  const handleDateMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setDateMenuAnchor(event.currentTarget);
  };

  const handleDateMenuClose = () => {
    setDateMenuAnchor(null);
  };

  const handleDateSelect = (date: string) => {
    // If selecting a date in the weekly system, convert to week start
    if (isWeeklySystem(date)) {
      const weekStart = getWeekStartForDate(date);
      setCurrentDate(weekStart);
      setIsWeeklyView(true);
    } else {
      setCurrentDate(date);
      setIsWeeklyView(false);
    }
    handleDateMenuClose();
  };

  // Refresh handler
  const handleRefresh = () => {
    if (refreshCooldown) return;

    setRefreshCooldown(true);
    loadSummary(currentDate, true);

    setTimeout(() => {
      setRefreshCooldown(false);
    }, 5000);
  };

  // Format date for display
  const formatDisplayDate = (dateString: string) => {
    if (dateString === yesterdayDate && !isWeeklyView) {
      return "Yesterday's Facts";
    }

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (isWeeklyView) {
      // Show week range for weekly view
      const weekEnd = new Date(date);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Check if this is the current week
      if (dateString === getCurrentWeekStart()) {
        return "This Week's Facts";
      }

      // Format as "Jan 26 - Feb 1"
      const startMonth = date.toLocaleDateString('en-US', { month: 'short' });
      const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
      const startDay = date.getDate();
      const endDay = weekEnd.getDate();

      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
      }
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Calculate participation percentage
  const getParticipationPercentage = () => {
    if (!summaryData) return 0;

    // Use the participationRate if available (for weekly summaries)
    if (summaryData.participationRate !== undefined) {
      return Math.round(summaryData.participationRate);
    }

    // Fallback for daily summaries
    if (summaryData.totalResponses === 0) return 0;
    // Assuming ~20 active family members
    return Math.min(100, Math.round((summaryData.totalResponses / 20) * 100));
  };

  // Get side comparison color
  const getSideColor = useCallback(
    (side: 'rob' | 'blair') => {
      return side === 'rob' ? theme.palette.info.main : '#d32f2f';
    },
    [theme.palette.info.main],
  );

  // Parse summary text and replace member names with clickable links
  const renderSummaryWithLinks = useMemo(() => {
    if (!summaryData?.summary || !hierarchyData?.family?.people) {
      return summaryData?.summary || '';
    }

    const people = hierarchyData.family.people;
    const memberNames = Object.entries(people)
      .filter(([_, person]) => person.familySide) // Only include people with a familySide
      .map(([userId, person]) => ({
        userId,
        name: person.name,
        familySide: person.familySide as 'rob' | 'blair' | 'center',
      }));

    // Sort by name length (longest first) to avoid partial matches
    memberNames.sort((a, b) => b.name.length - a.name.length);

    // Find all matches first
    const matches: Array<{
      start: number;
      end: number;
      userId: string;
      name: string;
      familySide: string;
    }> = [];
    memberNames.forEach(({ userId, name, familySide }) => {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      let match;

      while ((match = regex.exec(summaryData.summary)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + name.length,
          userId,
          name,
          familySide,
        });
      }
    });

    // Sort matches by start position and remove overlaps
    matches.sort((a, b) => a.start - b.start);
    const filteredMatches = matches.filter((match, index) => {
      if (index === 0) return true;
      const prevMatch = matches[index - 1];
      return match.start >= prevMatch.end;
    });

    // Build the result with clickable names
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    filteredMatches.forEach(({ start, end, userId, name, familySide }) => {
      // Add text before the name
      if (start > lastIndex) {
        elements.push(summaryData.summary.substring(lastIndex, start));
      }

      // Add the clickable name
      elements.push(
        <Box
          key={`${userId}-${start}`}
          component="span"
          onClick={() => onUserClick?.(userId)}
          sx={{
            color: getSideColor(familySide as 'rob' | 'blair'),
            fontWeight: 'bold',
            cursor: 'pointer',
            textDecoration: 'underline',
            textDecorationColor: 'transparent',
            transition: 'text-decoration-color 0.2s',
            '&:hover': {
              textDecorationColor: getSideColor(familySide as 'rob' | 'blair'),
            },
          }}
        >
          {name}
        </Box>,
      );

      lastIndex = end;
    });

    // Add any remaining text
    if (lastIndex < summaryData.summary.length) {
      elements.push(summaryData.summary.substring(lastIndex));
    }

    return elements.length > 0 ? elements : summaryData.summary;
  }, [summaryData?.summary, hierarchyData, onUserClick, getSideColor]);

  return (
    <Box sx={{ mb: 2 }}>
      <Card
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
          boxShadow: `0 2px 12px ${alpha('#000', 0.06)}`,

        }}
      >
        {/* Header — matches timeline/celebrations design */}
        <Box sx={{
          px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.08)}, ${alpha(theme.palette.secondary.dark, 0.04)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoAwesomeIcon sx={{ fontSize: 20, color: theme.palette.secondary.main }} />
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
              {isWeeklyView ? 'Weekly' : 'Daily'} Summary
            </Typography>
          </Box>
          <IconButton size="small"
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={loading || refreshCooldown}
            sx={{ color: theme.palette.text.secondary, '&:hover': { color: theme.palette.secondary.main } }}>
            {loading ? <LoadingDots size={4} inline /> : <RefreshIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        </Box>

        {/* Always-visible content — no expand/collapse */}
        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
          {/* Date nav — compact inline */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1.5 }}>
            <IconButton size="small" onClick={() => navigateDate('prev')}
              sx={{ p: 0.5, color: theme.palette.text.secondary }}>
              <ChevronLeftIcon sx={{ fontSize: 20 }} />
            </IconButton>

            <Button size="small" onClick={handleDateMenuClick}
              startIcon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
              endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 14 }} />}
              sx={{ fontSize: '0.75rem', textTransform: 'none', color: theme.palette.text.secondary, minWidth: 0 }}>
              {formatDisplayDate(currentDate)}
            </Button>

            <Menu id="date-select-menu" anchorEl={dateMenuAnchor} open={openDateMenu}
              onClose={handleDateMenuClose}
              slotProps={{ paper: { elevation: 3, sx: { maxHeight: 400, width: 250 } } }}>
              {getAvailableDates().map((date) => (
                <MenuItem key={date.value} onClick={() => handleDateSelect(date.value)}
                  selected={date.value === currentDate}>
                  <Typography variant="body2">
                    {date.label}
                    {date.isYesterday && <Chip label="Yesterday" size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />}
                    {date.isThisWeek && <Chip label="This Week" size="small" color="primary" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />}
                  </Typography>
                </MenuItem>
              ))}
            </Menu>

            <IconButton size="small" onClick={() => navigateDate('next')}
              disabled={currentDate === yesterdayDate}
              sx={{ p: 0.5, color: theme.palette.text.secondary }}>
              <ChevronRightIcon sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Summary content */}
          {loading ? (
            <Box>
              <Skeleton variant="text" width="100%" height={20} />
              <Skeleton variant="text" width="95%" height={20} />
              <Skeleton variant="text" width="85%" height={20} />
            </Box>
          ) : error ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2, fontSize: '0.8rem' }}>
              {error}
            </Typography>
          ) : summaryData ? (
            <Fade in={true} timeout={600}>
              <Box>
                {/* AI Summary — scrollable with fade hint */}
                <Box sx={{ position: 'relative', mb: 1.5 }}>
                  <Box sx={{
                    maxHeight: 180, overflowY: 'auto', pr: 0.5,
                    scrollbarWidth: 'thin',
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.text.secondary, 0.2), borderRadius: 2 },
                  }}>
                    <Typography sx={{
                      fontSize: '0.82rem', lineHeight: 1.65, color: theme.palette.text.primary,
                    }}>
                      {renderSummaryWithLinks}
                    </Typography>
                  </Box>
                  {/* Bottom fade — visual hint that content is scrollable */}
                  <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, height: 28,
                    background: `linear-gradient(transparent, ${theme.palette.background.paper})`,
                    pointerEvents: 'none',
                  }} />
                </Box>

                {/* Compact stats row */}
                <Box sx={{
                  display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center',
                  pt: 1, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                }}>
                  <Chip icon={<GroupsIcon />} label={`${summaryData.totalResponses} responses`} size="small"
                    sx={{ height: 22, fontSize: '0.65rem', bgcolor: alpha(theme.palette.primary.main, 0.08),
                      '& .MuiChip-icon': { fontSize: 14, color: theme.palette.primary.main } }} />

                  {isWeeklyView && summaryData.totalQuestions && (
                    <Chip icon={<QuestionAnswerIcon />}
                      label={`${summaryData.totalQuestions} Qs`} size="small"
                      onClick={() => setQuestionsDialogOpen(true)}
                      sx={{ height: 22, fontSize: '0.65rem', cursor: 'pointer',
                        bgcolor: alpha(theme.palette.secondary.main, 0.08),
                        '& .MuiChip-icon': { fontSize: 14, color: theme.palette.secondary.main },
                        '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.15) } }} />
                  )}

                  {/* Participation bar */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                    <LinearProgress variant="determinate" value={getParticipationPercentage()}
                      sx={{ width: 50, height: 4, borderRadius: 2,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': { borderRadius: 2,
                          background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` } }} />
                    <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: theme.palette.text.secondary }}>
                      {getParticipationPercentage()}%
                    </Typography>
                  </Box>

                  {/* Side comparison */}
                  {summaryData.totalResponses > 0 && (
                    <>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: getSideColor('rob') }} />
                        <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.secondary }}>
                          {summaryData.robSideResponses}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: getSideColor('blair') }} />
                        <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.secondary }}>
                          {summaryData.blairSideResponses}
                        </Typography>
                      </Box>
                    </>
                  )}
                </Box>
              </Box>
            </Fade>
          ) : null}
        </Box>
      </Card>

      {/* Questions Dialog */}
      <Dialog
        open={questionsDialogOpen}
        onClose={() => setQuestionsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            maxHeight: '80vh',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pb: 1,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QuestionAnswerIcon color="secondary" />
            <Typography variant="h6" component="span">
              Week&apos;s Questions
            </Typography>
          </Box>
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setQuestionsDialogOpen(false)}
            aria-label="close"
            size="small"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          <List sx={{ py: 0 }}>
            {summaryData?.dailyBreakdown &&
              Object.entries(summaryData.dailyBreakdown)
                .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                .map(([date, breakdown], index) => {
                  const dateObj = new Date(date + 'T12:00:00');
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  const formattedDate = dateObj.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <ListItem
                      key={date}
                      sx={{
                        borderBottom:
                          index < Object.entries(summaryData.dailyBreakdown || {}).length - 1
                            ? `1px solid ${alpha(theme.palette.divider, 0.1)}`
                            : 'none',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        py: 2,
                        px: 3,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.02),
                        },
                      }}
                    >
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          mb: 1,
                        }}
                      >
                        <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 600 }}>
                          {dayName}, {formattedDate}
                        </Typography>
                        <Chip
                          label={`${breakdown.responses} responses`}
                          size="small"
                          variant="outlined"
                          sx={{
                            borderColor: alpha(theme.palette.primary.main, 0.3),
                            color: theme.palette.primary.main,
                            height: 24,
                          }}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.6,
                          width: '100%',
                        }}
                      >
                        {breakdown.question || 'Question not available'}
                      </Typography>
                    </ListItem>
                  );
                })}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default DailyFactSummary;
