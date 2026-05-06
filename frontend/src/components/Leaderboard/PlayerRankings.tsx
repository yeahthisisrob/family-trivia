// components/Leaderboard/PlayerRankings.tsx
import { Box, useTheme, useMediaQuery, Typography, Divider } from '@mui/material';
import { motion } from 'framer-motion';
import React, { useMemo } from 'react';

import PlayerCard from './PlayerCard';
import Podium from './Podium';
import { LeaderboardEntry } from './utils';

interface PlayerRankingsProps {
  players: LeaderboardEntry[];
  currentUserId: string;
  onViewProfile?: (userId: string) => void;
  maxQuestionsAsked?: number;
}

const PlayerRankings: React.FC<PlayerRankingsProps> = ({
  players,
  currentUserId,
  onViewProfile,
  maxQuestionsAsked,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.accuracy ?? 0) - (a.accuracy ?? 0);
  }), [players]);

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
  const topThree = sortedPlayers.slice(0, 3).map((player, index) => ({
    ...player,
    rank: index + 1,
    questionsAnswered: player.questionsAnswered,
  }));

  return (
    <Box>
      {/* Podium for top 3 */}
      {topThree.length > 0 && <Podium players={topThree} onPlayerClick={handleViewProfile} maxQuestionsAsked={maxQuestionsAsked} />}

      {/* Divider between podium and all players */}
      {sortedPlayers.length > 0 && (
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
            Players
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
      )}

      {/* All players including those on podium */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: { xs: 1.5, sm: 2.5 },
        }}
      >
        {sortedPlayers.map((player, index) => {
          const rank = index + 1;
          return (
            <motion.div
              key={player.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Box
                sx={{
                  scrollMarginTop: '1rem',
                  ...(player.userId === currentUserId && {
                    // Highlight user's position with subtle animation on mobile
                    animation: isMobile ? 'pulseHighlight 2s ease-in-out 1' : 'none',
                    '@keyframes pulseHighlight': {
                      '0%, 100%': { transform: 'scale(1)' },
                      '50%': { transform: 'scale(1.02)' },
                    },
                  }),
                }}
              >
                <PlayerCard
                  player={player}
                  rank={rank}
                  isCurrentUser={player.userId === currentUserId}
                  onViewProfile={handleViewProfile}
                  maxQuestionsAsked={maxQuestionsAsked}
                />
              </Box>
            </motion.div>
          );
        })}
      </Box>
    </Box>
  );
};

export default PlayerRankings;
