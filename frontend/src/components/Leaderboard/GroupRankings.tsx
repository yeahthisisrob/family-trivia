// components/Leaderboard/GroupRankings.tsx
import { Box, Typography, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import React, { useMemo } from 'react';

import GroupCard from './GroupCard';
import Podium from './Podium';
import { LeaderboardEntry, GroupScore, calculateAdjustedGroupAverage } from './utils';
import { getUserGroup } from '../../utils';
import { createLogger } from '../../utils/logger';

const logger = createLogger('GroupRankings');

interface GroupRankingsProps {
  groups: GroupScore[];
  players: LeaderboardEntry[];
  userGroups?: Record<string, string>;
  onViewProfile?: (userId: string) => void;
}

const GroupRankings: React.FC<GroupRankingsProps> = ({
  groups,
  players,
  userGroups = {},
  onViewProfile,
}) => {
  // Sort groups by adjusted average score (excluding zero-point players)
  const sortedGroups = useMemo(() => {
    // Validate that we have valid data
    if (!groups || !players || groups.length === 0 || players.length === 0) {
      logger.warn('Missing or empty data', {
        groupsCount: groups?.length || 0,
        playersCount: players?.length || 0,
      });
      return [];
    }

    // Filter out invalid/incomplete group data
    const validGroups = groups.filter(
      (g) => g && g.groupId && typeof g.memberCount === 'number' && g.memberCount > 0,
    );

    logger.debug('Processing groups', {
      totalGroups: groups.length,
      validGroups: validGroups.length,
    });

    return validGroups.sort((a, b) => {
      // Use backend's calculated average if available, otherwise fall back to local calculation
      let aAvg = a.averageScore;
      let bAvg = b.averageScore;

      // Fall back to local calculation if backend average not available or is 0
      if (aAvg === undefined || aAvg === null || aAvg === 0) {
        const aPlayers = players.filter(
          (p) => p && (userGroups[p.userId] || getUserGroup(p.userId)) === a.groupId,
        );
        aAvg = calculateAdjustedGroupAverage(aPlayers);
      }

      if (bAvg === undefined || bAvg === null || bAvg === 0) {
        const bPlayers = players.filter(
          (p) => p && (userGroups[p.userId] || getUserGroup(p.userId)) === b.groupId,
        );
        bAvg = calculateAdjustedGroupAverage(bPlayers);
      }

      // Sort in descending order (higher average first)
      return bAvg - aAvg;
    });
  }, [groups, players, userGroups]);

  // Handler for navigating to a player's profile
  const handleViewProfile = (userId: string) => {
    if (onViewProfile) {
      onViewProfile(userId);
    } else {
      // Default fallback if no callback provided
      window.location.href = `/profile/${userId}`;
    }
  };

  // Get top 3 for podium display
  const topThree = sortedGroups.slice(0, 3).map((group, index) => {
    const groupPlayers = players.filter(
      (p) => (userGroups[p.userId] || getUserGroup(p.userId)) === group.groupId,
    );
    // Use backend's calculated average if available, otherwise fall back to local calculation
    const adjustedAverage = group.averageScore ?? calculateAdjustedGroupAverage(groupPlayers);
    const activePlayers = groupPlayers.filter((p) => p.score > 0);
    const accuracy = activePlayers.length > 0 && group.accuracy ? group.accuracy : undefined;

    return {
      userId: group.groupId, // Use groupId as userId for podium
      score: adjustedAverage, // Keep decimal for display
      rank: index + 1,
      accuracy,
      streak: undefined, // Groups don't have streaks
    };
  });

  return (
    <Box>
      {/* Podium for top 3 groups */}
      {topThree.length > 0 && (
        <Podium
          players={topThree}
          onPlayerClick={(groupId) => {
            // Find top player in group to navigate to
            const groupPlayers = players
              .filter((p) => (userGroups[p.userId] || getUserGroup(p.userId)) === groupId)
              .sort((a, b) => b.score - a.score);
            if (groupPlayers.length > 0) {
              handleViewProfile(groupPlayers[0].userId);
            }
          }}
          isGroupView={true}
        />
      )}

      {/* Divider between podium and all groups */}
      {sortedGroups.length > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', my: 3, px: 2 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography
            variant="caption"
            sx={{
              px: 2,
              color: 'text.secondary',
              fontWeight: 'medium',
            }}
          >
            Families
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
      )}

      {/* All groups including those on podium */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1.5, sm: 2.5 },
        }}
      >
        {sortedGroups.map((group, index) => {
          // Get players that belong to this group
          const groupPlayers = players.filter(
            (p) => (userGroups[p.userId] || getUserGroup(p.userId)) === group.groupId,
          );

          // Calculate category totals for the group
          const groupCategories: Record<string, number> = {};
          groupPlayers.forEach((player) => {
            if (player.categoryScores) {
              Object.entries(player.categoryScores).forEach(([category, score]) => {
                groupCategories[category] = (groupCategories[category] || 0) + score;
              });
            }
          });

          // Find top category
          const topGroupCategory = Object.entries(groupCategories).reduce(
            (max, [category, score]) => (score > max.score ? { category, score } : max),
            { category: '', score: 0 },
          ).category;

          return (
            <motion.div
              key={group.groupId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Box
                sx={{
                  scrollMarginTop: '1rem',
                }}
              >
                <GroupCard
                  group={group}
                  groupPlayers={groupPlayers}
                  rank={index + 1} // Rank starts from 1
                  groupCategories={groupCategories}
                  topGroupCategory={topGroupCategory}
                  onViewProfile={handleViewProfile}
                />
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
};

export default GroupRankings;
