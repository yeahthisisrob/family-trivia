// File: src/components/TriviaCard/TodayResult.tsx
// Compact, sleek display of today's answered question with all choices shown.

import BoltIcon from '@mui/icons-material/Bolt';
import CancelIcon from '@mui/icons-material/Cancel';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import {
  Box,
  Typography,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';

import { Question } from '../../api/modules/trivia';

interface TodayResultProps {
  question: Question;
  selected: string;
  result: { correct: boolean; streak: number; pointsEarned?: number };
}

const TodayResult: React.FC<TodayResultProps> = ({ question, selected, result }) => {
  const theme = useTheme();
  const isCorrect = result.correct;
  const accentColor = isCorrect ? theme.palette.success.main : theme.palette.error.main;

  // Detect game mode from question metadata
  const isCasinoRush = (question as any).mode === 'casino-rush' || (question as any).isCasinoRush;
  const isSlotMachine = (question as any).mode === 'slot-machine' || (question as any).isSlotMachine;
  const isGameMode = isCasinoRush || isSlotMachine;

  return (
    <Box sx={{
      mb: 1.5, borderRadius: 2.5,
      border: `1px solid ${alpha(accentColor, 0.15)}`,
      bgcolor: alpha(accentColor, 0.03),
      overflow: 'hidden',
    }}>
      {/* Header — result + points + streak */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.5, py: 0.75,
        bgcolor: alpha(accentColor, 0.06),
        borderBottom: `1px solid ${alpha(accentColor, 0.08)}`,
      }}>
        {isCorrect
          ? <CheckCircleIcon sx={{ fontSize: 16, color: accentColor }} />
          : <CancelIcon sx={{ fontSize: 16, color: accentColor }} />}

        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: accentColor, flex: 1 }}>
          {isCorrect ? 'Correct!' : 'Incorrect'}
        </Typography>

        {isGameMode && (
          isCasinoRush
            ? <CasinoIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
            : <SmartToyIcon sx={{ fontSize: 14, color: theme.palette.secondary.main }} />
        )}

        {result.pointsEarned != null && result.pointsEarned > 0 && (
          <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: accentColor }}>
            +{result.pointsEarned} pts
          </Typography>
        )}

        {result.streak > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.15 }}>
            <BoltIcon sx={{ fontSize: 13, color: theme.palette.warning.main }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: theme.palette.warning.dark }}>
              {result.streak}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Question text */}
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
        <Typography sx={{
          fontSize: '0.75rem', fontWeight: 500, lineHeight: 1.4,
          color: theme.palette.text.primary,
        }}>
          {question.question}
        </Typography>

        {question.category && (
          <Typography sx={{ fontSize: '0.55rem', color: theme.palette.text.disabled, mt: 0.25 }}>
            {question.category}
            {question.difficulty && question.difficulty !== 'normal' && ` · ${question.difficulty}`}
          </Typography>
        )}
      </Box>

      {/* Choices */}
      {question.choices && question.choices.length > 0 && (
        <Box sx={{ px: 1.5, pb: 1.25, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.4 }}>
          {question.choices.map((choice, i) => {
            const isSelected = choice === selected;
            const isAnswer = choice === question.answer;
            const isWrongPick = isSelected && !isCorrect;

            let bg = 'transparent';
            let borderColor = alpha(theme.palette.divider, 0.1);
            let textColor = theme.palette.text.secondary;
            let fontWeight = 400;
            let icon = null;

            if (isAnswer) {
              bg = alpha(theme.palette.success.main, 0.08);
              borderColor = alpha(theme.palette.success.main, 0.25);
              textColor = theme.palette.success.dark;
              fontWeight = 700;
              icon = <CheckCircleIcon sx={{ fontSize: 14, color: theme.palette.success.main }} />;
            } else if (isWrongPick) {
              bg = alpha(theme.palette.error.main, 0.06);
              borderColor = alpha(theme.palette.error.main, 0.2);
              textColor = theme.palette.error.main;
              fontWeight = 600;
              icon = <CancelIcon sx={{ fontSize: 14, color: theme.palette.error.main }} />;
            }

            return (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'center', gap: 0.75,
                px: 1, py: 0.4,
                borderRadius: 1.5,
                bgcolor: bg,
                border: `1px solid ${borderColor}`,
              }}>
                {/* Letter badge */}
                <Typography sx={{
                  fontSize: '0.55rem', fontWeight: 700,
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  bgcolor: isAnswer ? alpha(theme.palette.success.main, 0.15)
                    : isWrongPick ? alpha(theme.palette.error.main, 0.12)
                    : alpha(theme.palette.divider, 0.08),
                  color: isAnswer ? theme.palette.success.dark
                    : isWrongPick ? theme.palette.error.main
                    : theme.palette.text.disabled,
                  flexShrink: 0,
                }}>
                  {String.fromCharCode(65 + i)}
                </Typography>

                <Typography sx={{
                  fontSize: '0.68rem', fontWeight, color: textColor,
                  flex: 1, lineHeight: 1.3,
                }}>
                  {choice}
                </Typography>

                {icon}

                {isSelected && !isAnswer && (
                  <Typography sx={{ fontSize: '0.5rem', color: theme.palette.error.main, fontWeight: 600, flexShrink: 0 }}>
                    Your pick
                  </Typography>
                )}
                {isAnswer && isSelected && (
                  <Typography sx={{ fontSize: '0.5rem', color: theme.palette.success.main, fontWeight: 600, flexShrink: 0 }}>
                    Your pick
                  </Typography>
                )}
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default TodayResult;
