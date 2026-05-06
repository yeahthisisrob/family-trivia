import { Box, Typography } from '@mui/material';
import React, { useState, useEffect, useMemo } from 'react';

import { useTimeline } from '../../contexts/TimelineContext';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useUserTimeline } from '../../hooks/useUserTimeline';
import { getUserColor, getUserInitials } from '../../utils';
import { createLogger } from '../../utils/logger';
import CommentsTimeline from '../TimelineBoard/CommentsTimeline';
import FactTimeline from '../TimelineBoard/FactTimeline';
import ContentTypeSelector, { ContentType } from '../TimelineBoard/selectors/ContentTypeSelector';
import TriviaTimeline from '../TimelineBoard/TriviaTimeline';
import { LoadingDots } from '../ui/feedback';

interface UserTimelineProps {
  userId: string;
  onUserClick?: (userId: string) => void;
  refreshKey?: number;
}

const logger = createLogger('UserTimeline');

const UserTimeline: React.FC<UserTimelineProps> = ({ userId, onUserClick, refreshKey = 0 }) => {
  // Use user-specific timeline hook for efficient data loading
  const {
    timelineData,
    loading: timelineLoading,
    loadingMore,
    refresh,
    loadMore: loadMoreTimeline,
    hasMoreFacts,
    hasMoreTrivia,
  } = useUserTimeline({ userId });

  // Get comment counts from the main timeline context
  const { commentCounts } = useTimeline();

  // Local state
  const [contentType, setContentType] = useState<ContentType>('triviaHistory');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Update local loading state based on context loading state
  useEffect(() => {
    setIsLoading(timelineLoading);
  }, [timelineLoading]);

  // Refresh timeline when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      refresh();
    }
  }, [refreshKey, refresh]);

  // No need to filter - data is already user-specific from the API
  const filteredTimelineData = useMemo(() => {
    if (!timelineData) {
      return { facts: [], trivia: [], familySides: {} };
    }
    return timelineData;
  }, [timelineData]);

  // Filter and sort data based on content type
  const getFilteredData = () => {
    if (contentType === 'comments') {
      // Filter for items with comments using the counts map
      const factsWithComments = filteredTimelineData.facts
        .filter((fact) => (commentCounts.get(`fact:${fact.userId}_${fact.timestamp}`) ?? 0) > 0)
        .map((fact) => ({
          ...fact,
          type: 'fact' as const,
          commentCount: commentCounts.get(`fact:${fact.userId}_${fact.timestamp}`) ?? 0,
        }));

      const triviaWithComments = filteredTimelineData.trivia
        .filter((trivia) => (commentCounts.get(`trivia:${trivia.userId}_${trivia.timestamp}`) ?? 0) > 0)
        .map((trivia) => ({
          ...trivia,
          type: 'trivia' as const,
          commentCount: commentCounts.get(`trivia:${trivia.userId}_${trivia.timestamp}`) ?? 0,
        }));

      const mergedItems = [...factsWithComments, ...triviaWithComments]
        .sort((a, b) => b.commentCount - a.commentCount);

      return {
        facts: [],
        trivia: [],
        merged: mergedItems,
        familySides: filteredTimelineData.familySides,
      };
    }

    return {
      facts: contentType === 'funFacts' ? filteredTimelineData.facts : [],
      trivia: contentType === 'triviaHistory' ? filteredTimelineData.trivia : [],
      merged: [],
      familySides: filteredTimelineData.familySides,
    };
  };

  const filteredData = getFilteredData();

  // Determine if we have more data based on content type
  const hasMore =
    contentType === 'funFacts'
      ? hasMoreFacts
      : contentType === 'triviaHistory'
        ? hasMoreTrivia
        : false; // No pagination for comments view

  // Set up infinite scroll (disabled for now)
  const infiniteScrollRef = useInfiniteScroll({
    onLoadMore: loadMoreTimeline,
    hasMore,
    loading: loadingMore,
  });

  // Handle content type change
  const handleContentTypeChange = (type: ContentType) => {
    setContentType(type);
  };

  // Log data for debugging
  useEffect(() => {
    logger.debug('User timeline data', {
      userId,
      factsCount: filteredTimelineData.facts.length,
      triviaCount: filteredTimelineData.trivia.length,
      contentType,
    });
  }, [userId, filteredTimelineData, contentType]);

  return (
    <Box sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', fontSize: '1rem' }}>
          {contentType === 'funFacts'
            ? 'Personal Facts'
            : contentType === 'triviaHistory'
              ? 'Trivia History'
              : 'Comments'}
        </Typography>
      </Box>

      {/* Content Type Selector */}
      <ContentTypeSelector value={contentType} onChange={handleContentTypeChange} />

      {/* Loading indicator */}
      {isLoading && <LoadingDots mt={4} />}

      {/* Facts Timeline */}
      {!isLoading && contentType === 'funFacts' && (
        <>
          {filteredTimelineData.facts.length > 0 ? (
            <FactTimeline
              facts={filteredTimelineData.facts}
              onUserClick={onUserClick}
              currentUserId={userId}
              selectedSide="all"
            />
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No facts to display
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Trivia Timeline */}
      {!isLoading && contentType === 'triviaHistory' && (
        <>
          {filteredTimelineData.trivia.length > 0 ? (
            <TriviaTimeline
              refreshKey={refreshKey}
              onUserClick={onUserClick}
              currentUserId={userId}
              selectedSide="all"
              setIsLoading={setIsLoading}
              timelineData={filteredTimelineData}
            />
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No trivia history to display
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Comments Timeline */}
      {!isLoading && contentType === 'comments' && (
        <>
          {filteredData.merged.length > 0 ? (
            <CommentsTimeline
              mergedItems={filteredData.merged}
              onUserClick={onUserClick}
              currentUserId={userId}
              getUserColor={getUserColor}
              getUserInitials={getUserInitials}
            />
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body1" color="text.secondary">
                No comments to display
              </Typography>
            </Box>
          )}
        </>
      )}

      {/* Infinite scroll sentinel (disabled for user view) */}
      {!isLoading && hasMore && contentType !== 'comments' && (
        <Box ref={infiniteScrollRef} sx={{ height: 1, mt: 2 }} />
      )}

      {/* Loading more indicator */}
      {loadingMore && <LoadingDots size={7} mt={2} />}
    </Box>
  );
};

export default UserTimeline;
