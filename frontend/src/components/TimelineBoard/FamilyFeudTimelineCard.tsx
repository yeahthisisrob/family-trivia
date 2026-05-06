// File: src/components/TimelineBoard/FamilyFeudTimelineCard.tsx
// Timeline card for completed Family Feud rounds. Supports comments.

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import {
  Avatar,
  Box,
  Card,
  Chip,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

interface FeudGuess {
  userName: string;
  guess: string;
  correct: boolean;
}

interface FeudWinner {
  userId: string;
  userName: string;
  points: number;
}

interface FamilyFeudTimelineCardProps {
  entry: {
    userId: string;
    color: string;
    initials: string;
    question: string;
    answer: string;
    timestamp: string;
    group: string;
    category?: string;
    feudGuesses?: FeudGuess[];
    feudWinners?: FeudWinner[];
    feudGuessCount?: number;
  };
  onUserClick?: (userId: string) => void;
  children?: React.ReactNode;
}

const FamilyFeudTimelineCard: React.FC<FamilyFeudTimelineCardProps> = ({
  entry, onUserClick, children,
}) => {
  const theme = useTheme();

  return (
    <Card sx={{
      mb: 1.5, overflow: 'hidden', borderRadius: 2,
      border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}`,
      borderLeft: `4px solid ${theme.palette.secondary.main}`,
    }}>
      {/* Header */}
      <Box sx={{ px: 1.5, pt: 1.25, pb: 0.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{
          bgcolor: entry.color, width: 30, height: 30, fontSize: '0.7rem',
          cursor: onUserClick ? 'pointer' : 'default',
        }} onClick={() => onUserClick?.(entry.userId)}>
          {entry.initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{
              fontWeight: 600, fontSize: '0.85rem',
              cursor: onUserClick ? 'pointer' : 'default',
              '&:hover': onUserClick ? { color: theme.palette.primary.main } : {},
            }} onClick={() => onUserClick?.(entry.userId)}>
              {entry.userId}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.secondary }}>
              {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip size="small" icon={<GroupsIcon sx={{ fontSize: '12px !important' }} />}
              label="Family Feud" sx={{
                height: 18, fontSize: '0.55rem', fontWeight: 700,
                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                color: theme.palette.secondary.main,
                '& .MuiChip-icon': { color: theme.palette.secondary.main },
              }} />
            {entry.feudGuessCount !== undefined && (
              <Chip size="small" label={`${entry.feudGuessCount} guessed`} sx={{
                height: 18, fontSize: '0.55rem',
                bgcolor: alpha(theme.palette.divider, 0.08),
              }} />
            )}
          </Box>
        </Box>
      </Box>

      {/* Question + Answer */}
      <Box sx={{ px: 1.5, pb: 1 }}>
        <Typography sx={{ fontSize: '0.8rem', fontStyle: 'italic', mb: 0.5, lineHeight: 1.3 }}>
          "{entry.question}"
        </Typography>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', gap: 0.5,
          px: 1, py: 0.25, borderRadius: 1,
          bgcolor: alpha(theme.palette.success.main, 0.08),
          border: `1px solid ${alpha(theme.palette.success.main, 0.15)}`,
        }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: theme.palette.success.dark }}>
            {entry.answer}
          </Typography>
        </Box>

        {/* Guesses — show who picked what */}
        {entry.feudGuesses && entry.feudGuesses.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 0.3 }}>
            {entry.feudGuesses.map((g, i) => (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                py: 0.3, px: 0.75, borderRadius: 1.5,
                bgcolor: g.correct ? alpha(theme.palette.success.main, 0.06) : alpha(theme.palette.grey[500], 0.04),
              }}>
                <Avatar sx={{
                  width: 18, height: 18, fontSize: '0.5rem',
                  bgcolor: g.correct ? theme.palette.success.main : theme.palette.grey[400],
                }}>{g.userName[0]?.toUpperCase()}</Avatar>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, minWidth: 50 }}>
                  {g.userName}
                </Typography>
                <Typography sx={{
                  fontSize: '0.65rem', flex: 1,
                  color: g.correct ? theme.palette.success.dark : theme.palette.text.secondary,
                  fontWeight: g.correct ? 700 : 400,
                  textTransform: 'uppercase', letterSpacing: 0.3,
                }}>
                  {g.guess}
                </Typography>
                {/* Right side: trophy+points for correct, X for wrong */}
                {g.correct ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                    <EmojiEventsIcon sx={{ fontSize: 13, color: '#B8860B' }} />
                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: '#B8860B' }}>+2</Typography>
                    <CheckCircleIcon sx={{ fontSize: 12, color: theme.palette.success.main, ml: 0.2 }} />
                  </Box>
                ) : (
                  <CancelIcon sx={{ fontSize: 14, color: theme.palette.grey[400] }} />
                )}
              </Box>
            ))}
          </Box>
        )}

        {/* No separate winners section — points shown inline with guesses */}
      </Box>

      {/* Comments slot */}
      {children}
    </Card>
  );
};

export default FamilyFeudTimelineCard;
