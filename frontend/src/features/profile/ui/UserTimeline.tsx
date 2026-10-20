/**
 * Everything one person answered (their profile's "See every trivia answer"):
 * their trivia, their facts, and the ones the family commented on. It reads
 * their own timeline (entities/timeline), page by page as it scrolls.
 */
import { Box, Typography } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CommentsTimeline from '../../../components/TimelineBoard/CommentsTimeline';
import FactTimeline from '../../../components/TimelineBoard/FactTimeline';
import ContentTypeSelector, {
  type ContentType,
} from '../../../components/TimelineBoard/selectors/ContentTypeSelector';
import TriviaTimeline from '../../../components/TimelineBoard/TriviaTimeline';
import { LoadingDots } from '../../../components/ui/feedback';
import { useTimeline } from '../../../contexts/TimelineContext';
import { usePersonTimeline } from '../../../entities/timeline';
import { useInfiniteScroll } from '../../../hooks/useInfiniteScroll';
import { createLogger } from '../../../shared/lib/logger';
import { getUserColor, getUserInitials } from '../../../utils';

interface UserTimelineProps {
  userId: string;
  onUserClick?: (userId: string) => void;
}

const logger = createLogger('UserTimeline');
const NOTHING_YET = { facts: [], trivia: [], familySides: {} };
const ignoreLoading = () => undefined;

export const UserTimeline: React.FC<UserTimelineProps> = ({ userId, onUserClick }) => {
  const feed = usePersonTimeline(userId);
  const isLoading = feed.isPending;
  const loadingMore = feed.isFetchingNextPage;
  const hasMoreFacts = feed.data?.hasMoreFacts ?? false;
  const hasMoreTrivia = feed.data?.hasMoreTrivia ?? false;
  const { fetchNextPage } = feed;
  const loadMore = useCallback(() => void fetchNextPage(), [fetchNextPage]);

  // Get comment counts from the main timeline context
  const { commentCounts } = useTimeline();

  const [contentType, setContentType] = useState<ContentType>('triviaHistory');

  // A timeline that didn't load shows as empty, as before.
  const filteredTimelineData = useMemo(() => feed.data ?? NOTHING_YET, [feed.data]);

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
        .filter(
          (trivia) => (commentCounts.get(`trivia:${trivia.userId}_${trivia.timestamp}`) ?? 0) > 0,
        )
        .map((trivia) => ({
          ...trivia,
          type: 'trivia' as const,
          commentCount: commentCounts.get(`trivia:${trivia.userId}_${trivia.timestamp}`) ?? 0,
        }));

      const mergedItems = [...factsWithComments, ...triviaWithComments].sort(
        (a, b) => b.commentCount - a.commentCount,
      );

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
    onLoadMore: loadMore,
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
      {!isLoading &&
        contentType === 'funFacts' &&
        (filteredTimelineData.facts.length > 0 ? (
          <FactTimeline
            facts={filteredTimelineData.facts}
            onUserClick={onUserClick}
            currentUserId={userId}
            selectedSide="all"
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
              }}
            >
              No facts to display
            </Typography>
          </Box>
        ))}

      {/* Trivia Timeline */}
      {!isLoading &&
        contentType === 'triviaHistory' &&
        (filteredTimelineData.trivia.length > 0 ? (
          <TriviaTimeline
            onUserClick={onUserClick}
            currentUserId={userId}
            selectedSide="all"
            setIsLoading={ignoreLoading}
            timelineData={filteredTimelineData}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
              }}
            >
              No trivia history to display
            </Typography>
          </Box>
        ))}

      {/* Comments Timeline */}
      {!isLoading &&
        contentType === 'comments' &&
        (filteredData.merged.length > 0 ? (
          <CommentsTimeline
            mergedItems={filteredData.merged}
            onUserClick={onUserClick}
            currentUserId={userId}
            getUserColor={getUserColor}
            getUserInitials={getUserInitials}
          />
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography
              variant="body1"
              sx={{
                color: 'text.secondary',
              }}
            >
              No comments to display
            </Typography>
          </Box>
        ))}

      {/* Infinite scroll sentinel (disabled for user view) */}
      {!isLoading && hasMore && contentType !== 'comments' && (
        <Box ref={infiniteScrollRef} sx={{ height: 1, mt: 2 }} />
      )}

      {/* Loading more indicator */}
      {loadingMore && <LoadingDots size={7} mt={2} />}
    </Box>
  );
};
