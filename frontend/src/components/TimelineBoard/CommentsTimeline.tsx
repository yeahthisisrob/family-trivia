// File: src/components/TimelineBoard/CommentsTimeline.tsx
import { Box, Card, Typography, Divider, useTheme, keyframes } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import React, { useMemo, useCallback, useRef } from 'react';

import FactComments from './FactComments';
import FactTimelineCard from './FactTimelineCard';
import TriviaComments from './TriviaComments';
import TriviaTimelineCard from './TriviaTimelineCard';
import { FactItem, QuestionHistory } from '../../api/modules/user';
import { FamilySide } from '../../utils/familyUtils';

// Type for merged fact items with comment count and extra metadata
type FactWithComments = FactItem & {
  userId: string;
  username: string;
  groupId: string;
  familySide: FamilySide;
  type: 'fact';
  commentCount: number;
};

// Type for merged trivia items with comment count and extra metadata
type TriviaWithComments = QuestionHistory & {
  userId: string;
  username: string;
  groupId: string;
  familySide: FamilySide;
  type: 'trivia';
  commentCount: number;
};

// Union type for merged items
type MergedItem = FactWithComments | TriviaWithComments;

// Helper to format date labels
const getDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d');
};

// Highlight pulse animation
const highlightPulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(46, 125, 50, 0.15); }
  100% { box-shadow: 0 0 0 0 rgba(46, 125, 50, 0); }
`;

interface CommentsTimelineProps {
  mergedItems: MergedItem[];
  onUserClick?: (userId: string) => void;
  currentUserId?: string;
  getUserColor: (userId: string) => string;
  getUserInitials: (userId: string) => string;
  /** "fact:contentId" or "trivia:contentId" — scroll to and highlight this item */
  highlightContentId?: string | null;
  onHighlightConsumed?: () => void;
}

const CommentsTimeline: React.FC<CommentsTimelineProps> = ({
  mergedItems,
  onUserClick,
  currentUserId,
  getUserColor,
  getUserInitials,
  highlightContentId,
  onHighlightConsumed,
}) => {
  const theme = useTheme();
  // Track whether we've already scrolled for this highlight
  const consumedRef = useRef<string | null>(null);

  // Ref callback — React calls this when the highlighted card mounts.
  // No timeouts, no querySelector, no DOM walking.
  const highlightRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || !highlightContentId) return;
      if (consumedRef.current === highlightContentId) return;
      consumedRef.current = highlightContentId;

      // scrollIntoView in rAF to ensure layout is complete
      requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        onHighlightConsumed?.();
      });
    },
    [highlightContentId, onHighlightConsumed],
  );

  // Group items by date
  const groupedByDate = useMemo(() => {
    const dateGroups = new Map<string, MergedItem[]>();

    mergedItems.forEach((item) => {
      const date = parseISO(item.timestamp);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)?.push(item);
    });

    // Sort entries within each date group (newest first)
    dateGroups.forEach((entries) => {
      entries.sort((a, b) => {
        return parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime();
      });
    });

    // Convert to array and sort by date (newest first)
    return Array.from(dateGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, items]) => ({
        date: parseISO(dateKey + 'T00:00:00'),
        dateKey,
        items,
      }));
  }, [mergedItems]);

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, maxWidth: '100%' }}>
      {groupedByDate.length > 0 ? (
        groupedByDate.map((group) => (
          <Box key={group.dateKey}>
            {/* Date separator */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                my: 3,
                px: 2,
              }}
            >
              <Divider sx={{ flex: 1 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  px: 2,
                  fontWeight: 500,
                  backgroundColor: 'background.paper',
                }}
              >
                {getDateLabel(group.date)}
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>

            {/* Entries for this date */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {group.items.map((entry) => {
                const contentId = `${entry.type}:${entry.userId}_${entry.timestamp}`;
                const isHighlighted = highlightContentId === contentId;

                return (
                  <Card
                    key={contentId}
                    ref={isHighlighted ? highlightRef : undefined}
                    variant="outlined"
                    sx={{
                      borderColor: alpha(getUserColor(entry.userId), 0.3),
                      boxShadow: 0,
                      p: 2,
                      bgcolor:
                        entry.type === 'fact' && entry.skipped
                          ? alpha('#f5f5f5', 0.5)
                          : 'background.paper',
                      borderLeft: `4px solid ${getUserColor(entry.userId)}`,
                      width: '100%',
                      overflowX: 'hidden',
                      // Highlight animation when scrolled to from notification
                      ...(isHighlighted && {
                        animation: `${highlightPulse} 0.8s ease-out 0.5s 2`,
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: 1,
                      }),
                    }}
                  >
                    {entry.type === 'fact' ? (
                      // Render fact entry
                      <FactTimelineCard
                        entry={{
                          userId: entry.userId,
                          color: getUserColor(entry.userId),
                          initials: getUserInitials(entry.userId),
                          question: entry.question,
                          answer: entry.answer,
                          fact: entry.fact,
                          timestamp: entry.timestamp,
                          group: entry.groupId.replace(/-/g, ' '),
                          skipped: entry.skipped,
                        }}
                        onUserClick={onUserClick}
                      >
                        <FactComments
                          factId={`${entry.userId}_${entry.timestamp}`}
                          currentUserId={currentUserId || ''}
                          getUserColor={getUserColor}
                          getUserInitials={getUserInitials}
                        />
                      </FactTimelineCard>
                    ) : (
                      // Render trivia entry
                      <TriviaTimelineCard
                        entry={{
                          userId: entry.userId,
                          color: getUserColor(entry.userId),
                          initials: getUserInitials(entry.userId),
                          question: entry.question.question,
                          choices: entry.question.choices,
                          answer: entry.question.answer,
                          selectedAnswer: entry.selectedAnswer,
                          correct: entry.correct,
                          timestamp: entry.timestamp,
                          group: entry.groupId.replace(/-/g, ' '),
                          category: entry.question?.category,
                          difficulty: entry.question?.difficulty,
                          pointsEarned: entry.pointsEarned,
                          streak: entry.streak,
                          isCustomCategory: entry.isCustomCategory,
                        }}
                        onUserClick={onUserClick}
                      >
                        <TriviaComments
                          triviaId={`${entry.userId}_${entry.timestamp}`}
                          currentUserId={currentUserId || ''}
                          getUserColor={getUserColor}
                          getUserInitials={getUserInitials}
                        />
                      </TriviaTimelineCard>
                    )}
                  </Card>
                );
              })}
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No items with comments found
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CommentsTimeline;
