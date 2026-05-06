// File: src/components/Arcade/ArcadeLeaderboard.tsx
// Reusable high score list — shows rank, avatar, name, score, date, mode badge.

import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import StarIcon from '@mui/icons-material/Star';
import { Avatar, Box, Chip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { formatDistance } from 'date-fns';
import React from 'react';

import { colors } from '../../shared/design-system/tokens/colors';
import { getUserColor, getUserInitials } from '../../utils';

import type { HighScoreEntry } from '@family-trivia/shared';

interface Props {
  scores: HighScoreEntry[];
  currentUserId?: string;
  /** Highlight this as a new record */
  newRecordUserId?: string;
  maxItems?: number;
}

const MEDAL_COLORS = [colors.medal.gold, colors.medal.silver, colors.medal.bronze];

const ArcadeLeaderboard: React.FC<Props> = ({
  scores,
  currentUserId,
  newRecordUserId,
  maxItems = 10,
}) => {
  const theme = useTheme();
  const displayed = scores.slice(0, maxItems);

  if (displayed.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.disabled }}>
          No scores yet — be the first!
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {displayed.map((entry, i) => {
        const isCurrentUser = entry.userId === currentUserId;
        const isNewRecord = entry.userId === newRecordUserId;
        const rank = i + 1;

        return (
          <Box
            key={`${entry.userId}-${entry.mode}-${i}`}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              bgcolor: isCurrentUser
                ? alpha(theme.palette.primary.main, 0.08)
                : isNewRecord
                  ? alpha(colors.medal.gold, 0.08)
                  : 'transparent',
              border: isCurrentUser
                ? `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                : 'none',
              transition: 'all 0.2s',
            }}
          >
            {/* Rank */}
            <Box sx={{ width: 24, textAlign: 'center' }}>
              {rank <= 3 ? (
                <EmojiEventsIcon sx={{ fontSize: 18, color: MEDAL_COLORS[rank - 1] }} />
              ) : (
                <Typography sx={{
                  fontSize: '0.7rem', fontWeight: 600,
                  color: theme.palette.text.disabled,
                }}>
                  {rank}
                </Typography>
              )}
            </Box>

            {/* Avatar */}
            <Avatar sx={{
              width: 26, height: 26, fontSize: '0.55rem', fontWeight: 700,
              bgcolor: getUserColor(entry.userId),
            }}>
              {getUserInitials(entry.userId)}
            </Avatar>

            {/* Name + mode */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography sx={{
                  fontSize: '0.75rem',
                  fontWeight: isCurrentUser ? 700 : 500,
                  color: theme.palette.text.primary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {entry.userId}
                </Typography>
                {isNewRecord && (
                  <StarIcon sx={{ fontSize: 14, color: colors.medal.gold }} />
                )}
              </Box>
              <Typography sx={{
                fontSize: '0.58rem',
                color: theme.palette.text.disabled,
              }}>
                {(() => {
                  try {
                    return formatDistance(new Date(entry.date), new Date(), { addSuffix: true });
                  } catch { return ''; }
                })()}
                {' · '}
                {entry.mode === 'arcade' ? 'Arcade' : 'Trivia'}
              </Typography>
            </Box>

            {/* Score */}
            <Chip
              label={entry.score.toLocaleString()}
              size="small"
              sx={{
                height: 22,
                fontWeight: 700,
                fontSize: '0.7rem',
                bgcolor: rank === 1
                  ? alpha(colors.medal.gold, 0.15)
                  : alpha(theme.palette.divider, 0.08),
                color: rank === 1
                  ? '#B8860B'
                  : theme.palette.text.primary,
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
};

export default ArcadeLeaderboard;
