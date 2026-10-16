// File: src/components/TimelineBoard/TimelineBoardOptimized.tsx
import TimelineIcon from '@mui/icons-material/Timeline';
import { Box, Button, Card, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import type { MemberStatus } from '../../api';
import { useTimeline } from '../../contexts/TimelineContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { colors } from '../../shared/design-system';
import { getUserColor, getUserInitials } from '../../utils';
import type { FamilySide } from '../../utils/familyUtils';
import { LoadingDots } from '../ui/feedback';
import CommentsTimeline from './CommentsTimeline';
import FactTimeline from './FactTimeline';
import ContentTypeSelector, { type ContentType } from './selectors/ContentTypeSelector';
import FamilySideSelector from './selectors/FamilySideSelector';
import TriviaTimeline from './TriviaTimeline';

interface TimelineBoardOptimizedProps {
  members: MemberStatus[];
  refreshKey?: number;
  onUserClick?: (userId: string) => void;
  currentUserId?: string;
  /** "fact:contentId" or "trivia:contentId" — switches to comments tab and scrolls to item */
  highlightContentId?: string | null;
  onHighlightConsumed?: () => void;
}

const TimelineBoardOptimized: React.FC<TimelineBoardOptimizedProps> = ({
  refreshKey = 0,
  onUserClick,
  currentUserId,
  highlightContentId,
  onHighlightConsumed,
}) => {
  const theme = useTheme();
  const {
    timelineData,
    commentCounts,
    loadingMore,
    error: timelineError,
    hasMoreFacts,
    hasMoreTrivia,
    refreshTimeline,
    loadMoreTimeline,
    selectedSide,
    setSelectedSide,
  } = useTimeline();

  const [contentType, setContentType] = useState<ContentType>('funFacts');

  useEffect(() => {
    if (refreshKey > 0) refreshTimeline(true);
  }, [refreshKey, refreshTimeline]);

  // Handle notification highlight: switch to comments tab via callback
  const handleContentChange = React.useCallback((type: ContentType) => {
    setContentType(type);
  }, []);

  // When highlightContentId changes, switch to comments tab
  React.useEffect(() => {
    if (highlightContentId) handleContentChange('comments');
  }, [highlightContentId, handleContentChange]);

  const handleSideChange = (side: string) => {
    setSelectedSide(side as FamilySide | 'all');
  };

  const getFilteredData = () => {
    if (contentType === 'comments') {
      // Items with comments, plus the one a notification pointed at (it may
      // only have reactions so far).
      const talkedAbout = (key: string) =>
        (commentCounts.get(key) ?? 0) > 0 || key === highlightContentId;
      // Build merged items from timeline data using comment counts
      const factsWithComments = timelineData.facts
        .filter((f) => talkedAbout(`fact:${f.userId}_${f.timestamp}`))
        .map((fact) => ({
          ...fact,
          type: 'fact' as const,
          commentCount: commentCounts.get(`fact:${fact.userId}_${fact.timestamp}`) ?? 0,
        }));

      const triviaWithComments = timelineData.trivia
        .filter((t) => talkedAbout(`trivia:${t.userId}_${t.timestamp}`))
        .map((trivia) => ({
          ...trivia,
          type: 'trivia' as const,
          commentCount: commentCounts.get(`trivia:${trivia.userId}_${trivia.timestamp}`) ?? 0,
        }));

      const mergedItems = [...factsWithComments, ...triviaWithComments].sort(
        (a, b) => b.commentCount - a.commentCount,
      );

      return { facts: [], trivia: [], merged: mergedItems, familySides: timelineData.familySides };
    }
    return {
      facts: contentType === 'funFacts' ? timelineData.facts : [],
      trivia: contentType === 'triviaHistory' ? timelineData.trivia : [],
      merged: [],
      familySides: timelineData.familySides,
    };
  };

  const filteredData = getFilteredData();
  const hasMore =
    contentType === 'funFacts'
      ? hasMoreFacts
      : contentType === 'triviaHistory'
        ? hasMoreTrivia
        : false;

  const infiniteScrollRef = useInfiniteScroll({
    onLoadMore: loadMoreTimeline,
    hasMore,
    loading: loadingMore,
  });

  return (
    <Card
      sx={{
        mt: 2,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
        borderRadius: 3,
        boxShadow: `0 2px 12px ${alpha(colors.scrim, 0.06)}`,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.primary.dark, 0.04)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <TimelineIcon sx={{ fontSize: 20, color: theme.palette.primary.main }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', flex: 1 }}>
          Family Timeline
        </Typography>
      </Box>

      {/* Controls */}
      <Box sx={{ px: 2, pt: 1.5 }}>
        <ContentTypeSelector value={contentType} onChange={setContentType} />
        <FamilySideSelector value={selectedSide} onChange={handleSideChange} />
      </Box>

      {/* Content */}
      <Box sx={{ px: 1.5, pb: 2 }}>
        {timelineError && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              sx={{
                color: 'text.secondary',
                mb: 1,
                fontSize: '0.85rem',
              }}
            >
              Timeline failed to load
            </Typography>
            <Button variant="outlined" size="small" onClick={() => refreshTimeline(true)}>
              Retry
            </Button>
          </Box>
        )}

        {contentType === 'funFacts' && (
          <FactTimeline
            facts={timelineData.facts}
            onUserClick={onUserClick}
            currentUserId={currentUserId}
            selectedSide={selectedSide}
          />
        )}

        {contentType === 'triviaHistory' && (
          <TriviaTimeline
            refreshKey={refreshKey}
            onUserClick={onUserClick}
            currentUserId={currentUserId}
            selectedSide={selectedSide}
            setIsLoading={() => {}}
            timelineData={timelineData}
          />
        )}

        {contentType === 'comments' && (
          <CommentsTimeline
            mergedItems={filteredData.merged}
            onUserClick={onUserClick}
            currentUserId={currentUserId}
            getUserColor={getUserColor}
            getUserInitials={getUserInitials}
            highlightContentId={highlightContentId}
            onHighlightConsumed={onHighlightConsumed}
          />
        )}

        {hasMore && contentType !== 'comments' && (
          <Box ref={infiniteScrollRef} sx={{ height: 1, mt: 2 }} />
        )}

        {loadingMore && <LoadingDots size={7} mt={2} />}
      </Box>
    </Card>
  );
};

export default TimelineBoardOptimized;
