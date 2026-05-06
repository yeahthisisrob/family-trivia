// File: src/components/TimelineBoard/GameModeCard.tsx
// Unified card for Casino Rush and Slot Machine entries on the timeline.
// Clean, compact design that shows the question, answer, and result.

import CancelIcon from '@mui/icons-material/Cancel';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import {
  Avatar,
  Box,
  Card,
  Chip,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

interface GameEntry {
  question: string;
  choices?: string[];
  answer: string;
  selectedAnswer: string;
  correct: boolean;
  category?: string;
  pointsEarned?: number;
  multiplier?: number;
}

interface GameModeCardProps {
  mode: 'casino-rush' | 'slot-machine';
  entries: GameEntry[];
  userId: string;
  color: string;
  initials: string;
  group: string;
  timestamp: string;
  totalPoints: number;
  allCorrect?: boolean; // Casino Rush: all 3 correct = jackpot
  multiplier?: number;  // Slot Machine: spin multiplier
  onUserClick?: (userId: string) => void;
}

const GameModeCard: React.FC<GameModeCardProps> = ({
  mode,
  entries,
  userId,
  color,
  initials,
  group,
  timestamp,
  totalPoints,
  allCorrect,
  multiplier,
  onUserClick,
}) => {
  const theme = useTheme();
  const [page, setPage] = useState(0);
  const entry = entries[page] || entries[0];

  const isCasinoRush = mode === 'casino-rush';
  const isSlotMachine = mode === 'slot-machine';
  const won = isCasinoRush ? !!allCorrect : entry.correct;

  const accentColor = won ? theme.palette.success.main : theme.palette.error.main;
  const modeColor = isCasinoRush ? theme.palette.warning.main : theme.palette.secondary.main;
  const modeLabel = isCasinoRush ? 'Casino Rush' : 'Slot Machine';
  const modeIcon = isCasinoRush
    ? <CasinoIcon sx={{ fontSize: 14 }} />
    : <SmartToyIcon sx={{ fontSize: 14 }} />;

  return (
    <Card sx={{
      mb: 1.5, overflow: 'hidden',
      border: `1px solid ${alpha(modeColor, 0.3)}`,
      borderLeft: `4px solid ${modeColor}`,
    }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 1.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{
          bgcolor: color, width: 32, height: 32, fontSize: '0.75rem',
          cursor: onUserClick ? 'pointer' : 'default',
          boxShadow: `0 2px 6px ${alpha(color, 0.3)}`,
        }} onClick={() => onUserClick?.(userId)}>
          {initials}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{
              fontWeight: 600, fontSize: '0.9rem', cursor: onUserClick ? 'pointer' : 'default',
              '&:hover': onUserClick ? { color: theme.palette.primary.main } : {},
            }} onClick={() => onUserClick?.(userId)}>
              {userId}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary }}>
              {new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25, flexWrap: 'wrap' }}>
            <Chip size="small" icon={modeIcon} label={modeLabel} sx={{
              height: 20, fontSize: '0.6rem', fontWeight: 700,
              bgcolor: alpha(modeColor, 0.12), color: modeColor,
              border: `1px solid ${alpha(modeColor, 0.25)}`,
              '& .MuiChip-icon': { fontSize: 12 },
            }} />

            {isSlotMachine && multiplier && (
              <Chip size="small" label={`${multiplier}×`} sx={{
                height: 20, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: multiplier >= 5 ? alpha('#FFD700', 0.2) : alpha(theme.palette.info.main, 0.1),
                color: multiplier >= 5 ? 'goldenrod' : theme.palette.info.main,
                border: `1px solid ${multiplier >= 5 ? alpha('#FFD700', 0.4) : alpha(theme.palette.info.main, 0.2)}`,
              }} />
            )}

            <Chip size="small"
              icon={won ? <CheckCircleIcon sx={{ fontSize: '12px !important' }} /> : <CancelIcon sx={{ fontSize: '12px !important' }} />}
              label={isCasinoRush
                ? (won ? 'JACKPOT' : 'BUSTED')
                : (won ? `+${totalPoints} PTS` : '0 PTS')}
              sx={{
                height: 20, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: alpha(accentColor, 0.1), color: accentColor,
                border: `1px solid ${alpha(accentColor, 0.25)}`,
                '& .MuiChip-icon': { color: accentColor },
              }}
            />

            {isCasinoRush && won && totalPoints > 0 && (
              <Chip size="small" label={`+${totalPoints} PTS`} sx={{
                height: 20, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: theme.palette.success.main,
              }} />
            )}
          </Box>
        </Box>
      </Box>

      {/* Question content */}
      <Box sx={{ px: 2, pb: 1.5 }}>
        {entry.category && (
          <Typography variant="caption" sx={{ color: theme.palette.text.secondary, fontSize: '0.65rem' }}>
            {entry.category}
          </Typography>
        )}
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, mb: 0.75, lineHeight: 1.4 }}>
          {entry.question}
        </Typography>

        {/* Answer */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 0.75,
          p: 0.75, borderRadius: 1.5,
          bgcolor: alpha(entry.correct ? theme.palette.success.main : theme.palette.error.main, 0.06),
          border: `1px solid ${alpha(entry.correct ? theme.palette.success.main : theme.palette.error.main, 0.15)}`,
        }}>
          {entry.correct
            ? <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
            : <CancelIcon sx={{ fontSize: 16, color: theme.palette.error.main }} />}
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
            {entry.selectedAnswer}
          </Typography>
          {!entry.correct && (
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary, ml: 'auto' }}>
              → {entry.answer}
            </Typography>
          )}
        </Box>

        {/* Pagination for Casino Rush (3 questions) */}
        {isCasinoRush && entries.length > 1 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1, gap: 0.5 }}>
            <IconButton size="small" disabled={page === 0}
              onClick={() => setPage(p => p - 1)} sx={{ p: 0.25 }}>
              <NavigateBeforeIcon sx={{ fontSize: 18 }} />
            </IconButton>
            {entries.map((_, i) => (
              <Box key={i} onClick={() => setPage(i)} sx={{
                width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                bgcolor: i === page ? modeColor : alpha(theme.palette.text.secondary, 0.2),
                transition: 'all 0.2s',
              }} />
            ))}
            <IconButton size="small" disabled={page === entries.length - 1}
              onClick={() => setPage(p => p + 1)} sx={{ p: 0.25 }}>
              <NavigateNextIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default GameModeCard;
