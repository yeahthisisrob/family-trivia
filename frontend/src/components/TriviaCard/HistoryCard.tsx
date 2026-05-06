// File: src/components/TriviaCard/HistoryCard.tsx
// Read-only card showing a past trivia answer. Used in the carousel.

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Box, Card, Chip, Typography,
  alpha, useTheme,
} from '@mui/material';
import React from 'react';

import { colors } from '../../shared/design-system/tokens/colors';
import { radii } from '../../shared/design-system/tokens/radii';
import { shadows } from '../../shared/design-system/tokens/shadows';
import { getUserColor, getUserInitials } from '../../utils';
import CommentsThread from '../common/CommentsThread';

interface HistoryCardProps {
  userId: string;
  question: string;
  choices: string[];
  answer: string;         // correct answer
  selectedAnswer: string; // what the user picked
  correct: boolean;
  category?: string;
  pointsEarned?: number;
  timestamp: string;
}

const HistoryCard: React.FC<HistoryCardProps> = ({
  userId, question, choices, answer, selectedAnswer, correct,
  category, pointsEarned, timestamp,
}) => {
  const theme = useTheme();

  const fmtDate = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const accentColor = correct ? colors.result.correct : colors.result.incorrect;

  return (
    <Card sx={{
      overflow: 'hidden', borderRadius: `${radii.xl}px`,
      boxShadow: shadows.card,
      border: `1px solid ${alpha(accentColor, 0.18)}`,
      borderTop: `3px solid ${alpha(accentColor, 0.5)}`,
    }}>
      {/* Header */}
      <Box sx={{
        px: 1.5, py: 0.75,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${alpha(accentColor, 0.06)}, transparent)`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {correct
            ? <CheckCircleIcon sx={{ fontSize: 14, color: colors.result.correct }} />
            : <CancelIcon sx={{ fontSize: 14, color: colors.result.incorrect }} />}
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: colors.text.secondary }}>
            {fmtDate(timestamp)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {category && (
            <Chip label={category} size="small" variant="outlined"
              sx={{ height: 18, fontSize: '0.58rem', '& .MuiChip-label': { px: 0.75 } }} />
          )}
          {(pointsEarned ?? 0) > 0 && (
            <Chip label={`+${pointsEarned}`} size="small" color="primary"
              sx={{ height: 18, fontSize: '0.58rem', fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }} />
          )}
        </Box>
      </Box>

      {/* Content */}
      <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, lineHeight: 1.45, mb: 1, textAlign: 'center' }}>
          {question}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
          {choices.map(choice => {
            const isCorrectChoice = choice === answer;
            const isSelected = choice === selectedAnswer;
            const isRelevant = isCorrectChoice || isSelected;

            let bgcolor = 'transparent';
            let borderColor = alpha(theme.palette.divider, 0.1);
            let fontWeight = 400;
            let opacity = isRelevant ? 1 : 0.6;

            if (isCorrectChoice) {
              bgcolor = alpha(colors.result.correct, 0.08);
              borderColor = alpha(colors.result.correct, 0.35);
              fontWeight = 600;
            } else if (isSelected && !correct) {
              bgcolor = alpha(colors.result.incorrect, 0.06);
              borderColor = alpha(colors.result.incorrect, 0.3);
              fontWeight = 500;
            }

            return (
              <Box key={choice} sx={{
                py: 0.5, px: 1,
                borderRadius: `${radii.md}px`,
                border: `1px solid ${borderColor}`,
                bgcolor, opacity,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'opacity 0.2s',
                minHeight: 34,
              }}>
                <Typography sx={{ fontSize: '0.75rem', fontWeight, lineHeight: 1.3, flex: 1 }}>
                  {choice}
                </Typography>
                {isCorrectChoice && <CheckCircleIcon sx={{ color: colors.result.correct, fontSize: 15, ml: 0.5, flexShrink: 0 }} />}
                {isSelected && !correct && <CancelIcon sx={{ color: colors.result.incorrect, fontSize: 15, ml: 0.5, flexShrink: 0 }} />}
              </Box>
            );
          })}
        </Box>

        {/* Comments */}
        {timestamp && (
          <Box sx={{
            mt: 1, pt: 1,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
          }}>
            <CommentsThread
              contentId={`${userId}_${timestamp}`}
              contentType="trivia"
              currentUserId={userId}
              getUserColor={getUserColor}
              getUserInitials={getUserInitials}
              textOverrides={{ placeholderText: 'Add a comment...' }}
            />
          </Box>
        )}
      </Box>
    </Card>
  );
};

export default HistoryCard;
