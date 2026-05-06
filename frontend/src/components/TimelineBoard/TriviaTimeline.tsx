// File: src/components/TimelineBoard/TriviaTimeline.tsx
 
import { Box, Typography, Divider } from '@mui/material';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import React, { useState, useMemo } from 'react';

import FamilyFeudTimelineCard from './FamilyFeudTimelineCard';
import GameModeCard from './GameModeCard';
import TriviaComments from './TriviaComments';
import TimelineCard from './TriviaTimelineCard';
import { getUserColor, getUserInitials } from '../../utils';
import { isCustomCategory } from '../../utils/categoryUtils';
import { FamilySide, shouldIncludeInFamilySide } from '../../utils/familyUtils';
import { createLogger } from '../../utils/logger';

interface TriviaTimelineProps {
  refreshKey?: number;
  onUserClick?: (userId: string) => void;
  currentUserId?: string;
  selectedSide: string;
  setIsLoading: (loading: boolean) => void;
  timelineData?: {
    trivia: {
      userId: string;
      timestamp: string;
      question: {
        question: string;
        choices: string[];
        answer: string;
        category?: string;
        difficulty?: 'easy' | 'normal' | 'hard';
        mode?: string;
      };
      selectedAnswer: string;
      correct: boolean;
      groupId: string;
      familySide?: FamilySide;
      pointsEarned?: number;
      streak?: number;
      isCasinoRush?: boolean;
      questionNumber?: number;
      totalQuestions?: number;
      reason?: string;
      isCustomCategory?: boolean;
      isSlotMachine?: boolean;
      multiplier?: number;
    }[];
  };
}

interface TriviaEntry {
  userId: string;
  color: string;
  initials: string;
  question: string;
  choices: string[];
  answer: string; // Correct answer
  selectedAnswer: string; // User's selection
  correct: boolean;
  timestamp: string;
  group: string;
  familySide: FamilySide;
  category?: string;
  difficulty?: 'easy' | 'normal' | 'hard';
  pointsEarned?: number;
  streak?: number;
  isCasinoRush?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  reason?: string;
  isCustomCategory?: boolean;
  isSlotMachine?: boolean;
  multiplier?: number;
  isFamilyFeud?: boolean;
  feudGuesses?: Array<{ userName: string; guess: string; correct: boolean }>;
  feudWinners?: Array<{ userId: string; userName: string; points: number }>;
  feudGuessCount?: number;
}

interface GroupedTriviaEntry {
  entries: TriviaEntry[];
  isCasinoRush: boolean;
  isSlotMachine?: boolean;
  userId: string;
  timestamp: string;
  color: string;
  initials: string;
  isCustomCategory?: boolean;
  bestMultiplier?: number;
  totalPoints?: number;
}

// Helper to format date labels
const getDateLabel = (date: Date): string => {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d');
};

const TriviaTimeline: React.FC<TriviaTimelineProps> = ({
  refreshKey = 0,
  onUserClick,
  currentUserId,
  selectedSide,
  setIsLoading: _setIsLoading, // Prefix with underscore to indicate it's not used
  timelineData,
}) => {
  // Initialize logger for this component
  const logger = React.useMemo(() => createLogger('TriviaTimeline'), []);

  const [casinoRushPageIndices, setCasinoRushPageIndices] = useState<Record<string, number>>({});

  // Transform and filter timeline trivia data — derived synchronously, no render delay
  const filteredEntries = useMemo(() => {
    if (!timelineData?.trivia?.length) return [];

    try {
      const entries: TriviaEntry[] = timelineData.trivia.map((item) => {
        const isCasinoRush = Boolean(
          item.isCasinoRush ||
            (item.question &&
              typeof item.question === 'object' &&
              item.question.mode === 'casino-rush'),
        );

        const isSlotMachine = Boolean(
          item.isSlotMachine ||
            (item.question &&
              typeof item.question === 'object' &&
              item.question.mode === 'slot-machine'),
        );

        // Handle both nested question object and flat question string
        // (timelineService returns flat, old format uses nested)
        const q = typeof item.question === 'object' && item.question !== null
          ? item.question
          : { question: item.question as unknown as string, choices: (item as any).choices || [], answer: (item as any).answer || '', category: (item as any).category, difficulty: (item as any).difficulty, mode: (item as any).mode };

        return {
          userId: item.userId,
          color: getUserColor(item.userId),
          initials: getUserInitials(item.userId),
          question: q.question || '',
          choices: q.choices || [],
          answer: q.answer || '',
          selectedAnswer: item.selectedAnswer || (item as any).selectedAnswer || '',
          correct: item.correct,
          timestamp: item.timestamp,
          group: item.groupId,
          familySide: item.familySide || 'other',
          category: q.category,
          difficulty: q.difficulty,
          pointsEarned: item.pointsEarned,
          streak: item.streak,
          isCasinoRush,
          questionNumber: item.questionNumber,
          totalQuestions: item.totalQuestions,
          reason: item.reason,
          isCustomCategory:
            item.isCustomCategory ||
            (q.category ? isCustomCategory(q.category) : false),
          isSlotMachine,
          multiplier: item.multiplier,
          isFamilyFeud: !!(item as any).isFamilyFeud || (item as any).mode === 'family-feud' || q.mode === 'family-feud',
          feudGuesses: (item as any).allGuesses,
          feudWinners: (item as any).winners,
          feudGuessCount: (item as any).guessCount,
        };
      });

      // Debug: check for Family Feud data in raw items
      const rawFeud = (timelineData?.trivia || []).filter((item: any) =>
        item.isFamilyFeud || item.mode === 'family-feud' ||
        (item.question && typeof item.question === 'object' && item.question.mode === 'family-feud')
      );
      const feudEntries = entries.filter(e => e.isFamilyFeud);

      // Sort newest first
      entries.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

      // Filter by selected side
      if (selectedSide === 'all') return entries;
      return entries.filter((entry) => shouldIncludeInFamilySide(entry.userId, selectedSide));
    } catch (err) {
      logger.error('Error processing timeline data:', err);
      return [];
    }
  }, [timelineData, selectedSide, logger]);

  // Group entries by date and process Casino Rush and Slot Machine
  const groupedByDate = useMemo(() => {
    const dateGroups = new Map<string, (TriviaEntry | GroupedTriviaEntry)[]>();
    const casinoGroups: { [key: string]: TriviaEntry[] } = {};
    const slotMachineGroups: { [key: string]: TriviaEntry[] } = {};

    // First, process Casino Rush entries
    filteredEntries.forEach((entry) => {
      if (entry.isCasinoRush === true) {
        const entryDate = new Date(entry.timestamp);
        const dateKey = `${entryDate.getFullYear()}-${entryDate.getMonth()}-${entryDate.getDate()}`;
        const sessionKey = `${entry.userId}-${dateKey}`;

        if (!casinoGroups[sessionKey]) {
          casinoGroups[sessionKey] = [];
        }
        casinoGroups[sessionKey].push(entry);
      } else if (entry.isSlotMachine === true) {
        // Process Slot Machine entries
        const entryDate = new Date(entry.timestamp);
        const dateKey = `${entryDate.getFullYear()}-${entryDate.getMonth()}-${entryDate.getDate()}`;
        const sessionKey = `${entry.userId}-${dateKey}-slot`;

        if (!slotMachineGroups[sessionKey]) {
          slotMachineGroups[sessionKey] = [];
        }
        slotMachineGroups[sessionKey].push(entry);
      }
    });

    // Create grouped Casino Rush entries
    const groupedCasinoRush = new Map<string, GroupedTriviaEntry>();
    Object.entries(casinoGroups).forEach(([_sessionKey, casinoGroup]) => {
      if (casinoGroup.length === 0) return;

      const sorted = casinoGroup.sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
      const validEntries = sorted.filter(
        (entry) => entry.questionNumber !== undefined && entry.totalQuestions !== undefined,
      );

      if (validEntries.length > 0) {
        const groupTimestamp = validEntries[0].timestamp;
        groupedCasinoRush.set(groupTimestamp, {
          entries: validEntries,
          isCasinoRush: true,
          userId: validEntries[0].userId,
          timestamp: groupTimestamp,
          color: validEntries[0].color,
          initials: validEntries[0].initials,
          isCustomCategory: validEntries[0].isCustomCategory,
        });
      }
    });

    // Create grouped Slot Machine entries
    const groupedSlotMachine = new Map<string, GroupedTriviaEntry>();
    Object.entries(slotMachineGroups).forEach(([_sessionKey, slotGroup]) => {
      if (slotGroup.length === 0) return;

      const sorted = slotGroup.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

      // Calculate best multiplier and total points
      let bestMultiplier = 1;
      let totalPoints = 0;

      sorted.forEach((entry) => {
        if (entry.multiplier && entry.multiplier > bestMultiplier) {
          bestMultiplier = entry.multiplier;
        }
        if (entry.correct) {
          totalPoints += entry.pointsEarned || 0;
        }
      });

      const groupTimestamp = sorted[0].timestamp;
      groupedSlotMachine.set(groupTimestamp, {
        entries: sorted,
        isCasinoRush: false,
        isSlotMachine: true,
        userId: sorted[0].userId,
        timestamp: groupTimestamp,
        color: sorted[0].color,
        initials: sorted[0].initials,
        bestMultiplier,
        totalPoints,
      });
    });

    // Now group all entries by date
    filteredEntries.forEach((entry) => {
      if (entry.isCasinoRush === true || entry.isSlotMachine === true) {
        // Skip individual Casino Rush and Slot Machine entries, we'll add the grouped versions
        return;
      }
      // Family Feud entries are standalone — don't skip them

      const timestampString =
        typeof entry.timestamp === 'string'
          ? entry.timestamp
          : new Date(entry.timestamp).toISOString();
      const date = parseISO(timestampString);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)?.push(entry);
    });

    // Add grouped Casino Rush entries to their respective dates
    groupedCasinoRush.forEach((groupedEntry) => {
      const timestampString =
        typeof groupedEntry.timestamp === 'string'
          ? groupedEntry.timestamp
          : new Date(groupedEntry.timestamp).toISOString();
      const date = parseISO(timestampString);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)?.push(groupedEntry);
    });

    // Add grouped Slot Machine entries to their respective dates
    groupedSlotMachine.forEach((groupedEntry) => {
      const timestampString =
        typeof groupedEntry.timestamp === 'string'
          ? groupedEntry.timestamp
          : new Date(groupedEntry.timestamp).toISOString();
      const date = parseISO(timestampString);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)?.push(groupedEntry);
    });

    // Sort entries within each date group
    dateGroups.forEach((entries) => {
      entries.sort((a, b) => {
        const timestampA = 'entries' in a ? a.timestamp : a.timestamp;
        const timestampB = 'entries' in b ? b.timestamp : b.timestamp;
        const timestampStringA =
          typeof timestampA === 'string' ? timestampA : new Date(timestampA).toISOString();
        const timestampStringB =
          typeof timestampB === 'string' ? timestampB : new Date(timestampB).toISOString();
        return parseISO(timestampStringB).getTime() - parseISO(timestampStringA).getTime();
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
  }, [filteredEntries]);

  // Helper to check if an entry is grouped
  const isGroupedEntry = (entry: TriviaEntry | GroupedTriviaEntry): entry is GroupedTriviaEntry => {
    return 'entries' in entry && Array.isArray(entry.entries);
  };

  // Handle Casino Rush page navigation
  const handleCasinoRushPage = (sessionKey: string, direction: 'prev' | 'next') => {
    const currentIndex = casinoRushPageIndices[sessionKey] || 0;
    setCasinoRushPageIndices((prev) => {
      const newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
      return { ...prev, [sessionKey]: newIndex };
    });
  };

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
              {group.items.map((e, i) => {
                const isGrouped = isGroupedEntry(e);
                const sessionKey = isGrouped
                  ? `${e.userId}-${new Date(e.timestamp).toDateString()}`
                  : '';
                const currentPageIndex = casinoRushPageIndices[sessionKey] || 0;

                // For grouped entries, show current question based on page index
                const displayEntry: TriviaEntry = isGrouped
                  ? e.entries[currentPageIndex] || e.entries[0]
                  : (e as TriviaEntry);

                return (
                  <Box key={`${displayEntry.userId}_${displayEntry.timestamp}`}>
                    {isGrouped && (e.isCasinoRush || e.isSlotMachine) ? (
                      <GameModeCard
                        mode={e.isCasinoRush ? 'casino-rush' : 'slot-machine'}
                        entries={e.entries.map((en: any) => ({
                          question: en.question || (typeof en.question === 'object' ? en.question.question : ''),
                          choices: en.choices,
                          answer: en.answer,
                          selectedAnswer: en.selectedAnswer,
                          correct: en.correct,
                          category: en.category,
                          pointsEarned: en.pointsEarned,
                          multiplier: en.multiplier,
                        }))}
                        userId={e.userId}
                        color={e.color}
                        initials={e.initials}
                        group={e.entries[0]?.group || ''}
                        timestamp={e.timestamp}
                        totalPoints={e.totalPoints || 0}
                        allCorrect={e.isCasinoRush ? e.entries.every((en: any) => en.correct) : undefined}
                        multiplier={e.isSlotMachine ? e.bestMultiplier : undefined}
                        onUserClick={onUserClick}
                      />
                    ) : displayEntry.isFamilyFeud ? (
                      <FamilyFeudTimelineCard
                        entry={displayEntry}
                        onUserClick={onUserClick}
                      />
                    ) : (
                      <>
                        <TimelineCard
                          entry={displayEntry}
                          onUserClick={onUserClick}
                          wrapWithCard={true}
                        />
                        <TriviaComments
                          triviaId={`${displayEntry.userId}_${displayEntry.timestamp}`}
                          currentUserId={currentUserId || ''}
                          getUserColor={getUserColor}
                          getUserInitials={getUserInitials}
                        />
                      </>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ))
      ) : (
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            No trivia history found for the selected family side
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default TriviaTimeline;
