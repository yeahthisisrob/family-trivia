// File: src/components/Leaderboard/DifficultyBreakdown.tsx
import EmojiObjectsIcon from '@mui/icons-material/EmojiObjects';
import FlareIcon from '@mui/icons-material/Flare';
import SchoolIcon from '@mui/icons-material/School';
import { Box, Typography, LinearProgress, useTheme, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

import { calculatePercentage, getDifficultyInfo } from './utils';

export interface DifficultyStats {
  easy: number;
  normal: number;
  hard: number;
  total: number;
}

interface DifficultyBreakdownProps {
  stats: DifficultyStats;
}

const DifficultyBreakdown: React.FC<DifficultyBreakdownProps> = ({ stats }) => {
  const theme = useTheme();
  const levels: Array<'easy' | 'normal' | 'hard'> = ['easy', 'normal', 'hard'];

  // If there's nothing to show, bail early
  if (!stats.total) {
    return (
      <Typography variant="body2" color="text.secondary">
        No difficulty data yet.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
        Difficulty Breakdown
      </Typography>

      {levels.map((lvl) => {
        const count = stats[lvl];
        if (!count) return null;

        const percentage = calculatePercentage(count, stats.total);
        const info = getDifficultyInfo(lvl);
        const Icon = lvl === 'easy' ? EmojiObjectsIcon : lvl === 'hard' ? FlareIcon : SchoolIcon;
        const colorKey = lvl === 'easy' ? 'success' : lvl === 'hard' ? 'error' : 'primary';

        return (
          <Box key={lvl} sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Tooltip title={`${info.label} (${info.pointsLabel})`}>
                  <Icon sx={{ mr: 0.5, color: theme.palette[colorKey].main }} />
                </Tooltip>
                <Typography variant="caption">{info.label}</Typography>
              </Box>
              <Typography variant="caption">
                {count} ({Math.round(percentage)}%)
              </Typography>
            </Box>

            <LinearProgress
              variant="determinate"
              value={percentage}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: alpha(theme.palette[colorKey].main, 0.2),
                '& .MuiLinearProgress-bar': {
                  bgcolor: theme.palette[colorKey].main,
                },
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default DifficultyBreakdown;
