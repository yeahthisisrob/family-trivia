// File: frontend/src/components/Leaderboard/Podium.tsx
import BoltIcon from '@mui/icons-material/Bolt';
import { Box, Typography, Avatar, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { motion } from 'framer-motion';
import React from 'react';

import { getUserInitials, getUserColor } from './utils';
import { colors as dsColors } from '../../shared/design-system/tokens/colors';

interface PodiumPlayer {
  userId: string;
  score: number;
  rank: number;
  streak?: number;
  accuracy?: number;
  questionsAnswered?: number;
}

interface PodiumProps {
  players: PodiumPlayer[];
  onPlayerClick?: (userId: string) => void;
  isGroupView?: boolean;
  maxQuestionsAsked?: number;
}

const MEDAL = {
  1: { color: dsColors.medal.gold, label: '1st' },
  2: { color: dsColors.medal.silver, label: '2nd' },
  3: { color: dsColors.medal.bronze, label: '3rd' },
} as const;

const PodiumStep: React.FC<{
  player: PodiumPlayer;
  position: 'first' | 'second' | 'third';
  onPlayerClick?: (userId: string) => void;
}> = ({ player, position, onPlayerClick }) => {
  const theme = useTheme();
  const medal = MEDAL[player.rank as 1 | 2 | 3];

  const config = {
    first:  { avatarSize: 64, platformH: { xs: 110, sm: 140 }, delay: 0.15, flex: '0 0 38%' },
    second: { avatarSize: 52, platformH: { xs: 80, sm: 105 },  delay: 0.05, flex: '0 0 31%' },
    third:  { avatarSize: 52, platformH: { xs: 60, sm: 80 },   delay: 0.25, flex: '0 0 31%' },
  }[position];

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: config.delay }}
      style={{ flex: config.flex, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Player info */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: config.delay + 0.2, type: 'spring', stiffness: 400, damping: 15 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        style={{ marginBottom: 10, cursor: onPlayerClick ? 'pointer' : 'default', textAlign: 'center' }}
        onClick={() => onPlayerClick?.(player.userId)}
      >
        {/* Avatar with medal ring */}
        <Box sx={{ position: 'relative', display: 'inline-block', mb: 0.75 }}>
          <Avatar
            sx={{
              width: config.avatarSize,
              height: config.avatarSize,
              bgcolor: getUserColor(player.userId),
              fontWeight: 700,
              fontSize: position === 'first' ? '1.4rem' : '1.1rem',
              border: `3px solid ${medal.color}`,
              boxShadow: `0 0 0 2px ${alpha(medal.color, 0.2)}, 0 4px 12px ${alpha(medal.color, 0.25)}`,
            }}
          >
            {getUserInitials(player.userId)}
          </Avatar>

          {/* Rank badge */}
          <Box sx={{
            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
            bgcolor: medal.color,
            color: position === 'first' ? '#5a3d00' : '#fff',
            fontSize: '0.55rem', fontWeight: 800, lineHeight: 1,
            px: 0.75, py: 0.3, borderRadius: 1,
            boxShadow: `0 2px 6px ${alpha(medal.color, 0.4)}`,
            letterSpacing: 0.5,
          }}>
            {medal.label}
          </Box>
        </Box>

        {/* Name only */}
        <Typography sx={{
          fontWeight: 700,
          fontSize: position === 'first' ? '1.05rem' : '0.9rem',
          lineHeight: 1.2, mt: 0.5,
          color: theme.palette.text.primary,
        }}>
          {player.userId}
        </Typography>
      </motion.div>

      {/* Platform with stats inside */}
      <Box sx={{ width: '100%', height: config.platformH }}>
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: config.delay + 0.05 }}
          style={{ width: '100%', height: '100%', transformOrigin: 'bottom' }}
        >
          <Box sx={{
            width: '100%', height: '100%',
            background: `linear-gradient(180deg, ${alpha(medal.color, 0.35)} 0%, ${alpha(medal.color, 0.15)} 100%)`,
            borderRadius: '10px 10px 0 0',
            border: `1px solid ${alpha(medal.color, 0.3)}`,
            borderBottom: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 0.25,
          }}>
            {/* Score */}
            <Typography sx={{
              fontWeight: 800,
              fontSize: position === 'first' ? { xs: '1.3rem', sm: '1.5rem' } : { xs: '1.05rem', sm: '1.2rem' },
              color: medal.color,
              lineHeight: 1,
              filter: `drop-shadow(0 1px 3px ${alpha(medal.color, 0.5)})`,
            }}>
              {typeof player.score === 'number' ? player.score.toFixed(1) : player.score}
            </Typography>

            {/* Stats row */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, justifyContent: 'center' }}>
              {player.accuracy !== undefined && (
                <Typography sx={{
                  fontSize: '0.6rem', fontWeight: 600,
                  color: player.accuracy >= 70 ? theme.palette.success.dark : theme.palette.text.secondary,
                }}>
                  {player.accuracy}%
                </Typography>
              )}
              {player.streak != null && player.streak > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.15 }}>
                  <BoltIcon sx={{ fontSize: 12, color: theme.palette.warning.main }} />
                  <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: theme.palette.warning.dark }}>
                    {player.streak}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </motion.div>
      </Box>
    </motion.div>
  );
};

export default function Podium({ players, onPlayerClick, isGroupView = false }: PodiumProps) {
  const theme = useTheme();
  const podiumPlayers = players.slice(0, 3);

  // Reorder: [2nd, 1st, 3rd]
  const orderedPlayers = [podiumPlayers[1], podiumPlayers[0], podiumPlayers[2]].filter(Boolean);
  const positions: ('second' | 'first' | 'third')[] = ['second', 'first', 'third'];

  return (
    <Box sx={{
      position: 'relative', mb: 3,
      px: { xs: 1, sm: 2 }, pt: 2, pb: 0,
      borderRadius: 3,
      overflow: 'hidden',
    }}>
      {/* Title */}
      <motion.div
        initial={{ y: -15, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Typography sx={{
          textAlign: 'center', mb: 2.5,
          fontWeight: 800, fontSize: '0.85rem',
          color: theme.palette.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}>
          Top {isGroupView ? 'Groups' : 'Players'}
        </Typography>
      </motion.div>

      {/* Podium */}
      <Box sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: { xs: 0.5, sm: 1 },
        minHeight: { xs: 240, sm: 300 },
      }}>
        {orderedPlayers.map((player, index) => (
          <PodiumStep
            key={player.userId}
            player={player}
            position={positions[index]}
            onPlayerClick={onPlayerClick}
          />
        ))}
      </Box>
    </Box>
  );
}
