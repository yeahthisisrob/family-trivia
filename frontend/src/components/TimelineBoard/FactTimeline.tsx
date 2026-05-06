// File: src/components/TimelineBoard/FactTimeline.tsx
import { Box, Card, Typography, Divider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import React, { useMemo } from 'react';

import FactComments from './FactComments';
import FactTimelineCard from './FactTimelineCard';
import FamilyFeudTimelineCard from './FamilyFeudTimelineCard';
import { shouldIncludeInFamilySide } from '../../utils/familyUtils';
import { createLogger } from '../../utils/logger';

// Define fact item type
interface FactItem {
  userId: string;
  username: string;
  groupId: string;
  familySide?: string;
  timestamp: string;
  question: string;
  fact?: string;
  answer?: string;
  skipped?: boolean;
  category?: string;
}

interface FactTimelineProps {
  facts: FactItem[];
  onUserClick?: (userId: string) => void;
  currentUserId?: string;
  selectedSide?: string;
}

// Helper to format date labels
const getDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d');
};

const FactTimeline: React.FC<FactTimelineProps> = ({
  facts,
  onUserClick,
  currentUserId,
  selectedSide = 'all',
}) => {
  // Initialize logger for this component
  const logger = createLogger('FactTimeline');

  // Filter facts by selected side — derived synchronously, no render delay
  const filteredFacts = useMemo(
    () =>
      selectedSide === 'all'
        ? facts
        : facts.filter((fact) => shouldIncludeInFamilySide(fact.userId, selectedSide)),
    [facts, selectedSide],
  );

  // Get user color - utility function
  const getUserColor = (userId: string) => {
    const colors = [
      '#1976d2',
      '#388e3c',
      '#d32f2f',
      '#7b1fa2',
      '#c2185b',
      '#0288d1',
      '#fbc02d',
      '#455a64',
    ];
    const sum = userId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return colors[sum % colors.length];
  };

  // Get user initials - utility function
  const getUserInitials = (userId: string) => {
    const parts = userId.split(/[-_ ]/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : userId.slice(0, 2).toUpperCase();
  };

  // Group facts by date
  const groupedFacts = useMemo(() => {
    const groups = new Map<string, FactItem[]>();

    filteredFacts.forEach((fact) => {
      const date = parseISO(fact.timestamp);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)?.push(fact);
    });

    // Convert to array and sort by date (newest first)
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, items]) => ({
        date: parseISO(dateKey + 'T00:00:00'),
        dateKey,
        items: items.sort(
          (a, b) => parseISO(b.timestamp).getTime() - parseISO(a.timestamp).getTime(),
        ),
      }));
  }, [filteredFacts]);

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, maxWidth: '100%' }}>
      {groupedFacts.length > 0 ? (
        groupedFacts.map((group) => (
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

            {/* Facts for this date */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {group.items.map((entry, i) => (
                (entry as any).isFamilyFeud || (entry as any).questionType === 'family-feud' ? (
                  <FamilyFeudTimelineCard
                    key={`feud-${entry.userId}_${entry.timestamp}`}
                    entry={{
                      userId: entry.userId,
                      color: getUserColor(entry.userId),
                      initials: getUserInitials(entry.userId),
                      question: entry.question,
                      answer: entry.answer || entry.fact || '',
                      timestamp: entry.timestamp,
                      group: entry.groupId.replace(/-/g, ' '),
                      feudGuesses: (entry as any).allGuesses,
                      feudWinners: (entry as any).winners,
                      feudGuessCount: (entry as any).guessCount,
                    }}
                    onUserClick={onUserClick}
                  >
                    <FactComments
                      factId={`${entry.userId}_${entry.timestamp}`}
                      currentUserId={currentUserId || ''}
                      getUserColor={getUserColor}
                      getUserInitials={getUserInitials}
                    />
                  </FamilyFeudTimelineCard>
                ) : <Card
                  key={`${entry.userId}_${entry.timestamp}`}
                  variant="outlined"
                  sx={{
                    borderColor: alpha(getUserColor(entry.userId), 0.3),
                    boxShadow: 0,
                    p: 0.75,
                    bgcolor: entry.skipped ? alpha('#f5f5f5', 0.5) : 'background.paper',
                    borderLeft: `4px solid ${getUserColor(entry.userId)}`,
                    width: '100%',
                    overflowX: 'hidden',
                  }}
                >
                  <FactTimelineCard
                    entry={{
                      userId: entry.userId,
                      color: getUserColor(entry.userId),
                      initials: getUserInitials(entry.userId),
                      question: entry.question,
                      answer: entry.answer || '',
                      fact: entry.fact,
                      timestamp: entry.timestamp,
                      group: entry.groupId.replace(/-/g, ' '),
                      skipped: entry.skipped,
                      isCustomFact: entry.category === 'Custom Category',
                    }}
                    onUserClick={onUserClick}
                    wrapWithCard={false}
                  >
                    <FactComments
                      factId={`${entry.userId}_${entry.timestamp}`}
                      currentUserId={currentUserId || ''}
                      getUserColor={getUserColor}
                      getUserInitials={getUserInitials}
                    />
                  </FactTimelineCard>
                </Card>
              ))}
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No facts found for the selected family side
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default FactTimeline;
