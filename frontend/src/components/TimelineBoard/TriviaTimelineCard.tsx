// Individual card component for timeline
import CasinoIcon from '@mui/icons-material/Casino';
import SchoolIcon from '@mui/icons-material/School';
import { Avatar, Box, Card, Chip, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

import CustomCategoryBanner from './CustomCategoryBanner';
import AnswerResultDialog from '../TriviaCard/AnswerResultDialog';

interface TriviaEntry {
  userId: string;
  color: string;
  initials: string;
  question: string;
  choices: string[];
  answer: string;
  selectedAnswer: string;
  correct: boolean;
  timestamp: string;
  group: string;
  category?: string;
  difficulty?: 'easy' | 'normal' | 'hard';
  pointsEarned?: number;
  streak?: number;
  isCasinoRush?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
  isCustomCategory?: boolean;
}

interface TimelineCardProps {
  entry: TriviaEntry;
  onUserClick?: (userId: string) => void;
  isGrouped?: boolean;
  children?: React.ReactNode;
  wrapWithCard?: boolean;
}

const TimelineCard: React.FC<TimelineCardProps> = ({
  entry,
  onUserClick,
  isGrouped,
  children,
  wrapWithCard = false,
}) => {
  const theme = useTheme();
  const [showAnswerDialog, setShowAnswerDialog] = useState(false);

  const cardContent = (
    <>
      <Box sx={{ p: 2, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            mb: 1.5,
          }}
        >
          <Avatar
            sx={{
              bgcolor: entry.color,
              width: 36,
              height: 36,
              fontSize: '0.8rem',
              cursor: onUserClick ? 'pointer' : 'default',
              transition: 'all 0.2s ease',
              boxShadow: `0 2px 8px ${alpha(entry.color, 0.3)}`,
              '&:hover': onUserClick
                ? {
                    transform: 'scale(1.05)',
                    boxShadow: `0 4px 12px ${alpha(entry.color, 0.4)}`,
                  }
                : {},
            }}
            onClick={() => onUserClick && onUserClick(entry.userId)}
          >
            {entry.initials}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 0.75,
              }}
            >
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: onUserClick ? 'pointer' : 'default',
                  lineHeight: 1.2,
                  transition: 'all 0.2s ease',
                  color: theme.palette.text.primary,
                  '&:hover': onUserClick
                    ? {
                        color: theme.palette.primary.main,
                      }
                    : {},
                }}
                onClick={() => onUserClick && onUserClick(entry.userId)}
              >
                {entry.userId}
              </Typography>

              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  color: theme.palette.text.secondary,
                  fontWeight: 500,
                }}
              >
                {new Date(entry.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                label={entry.group}
                size="small"
                sx={{
                  bgcolor: alpha(entry.color, 0.1),
                  color: entry.color,
                  fontSize: '0.7rem',
                  height: 20,
                  px: 0.5,
                  fontWeight: 600,
                  borderRadius: 1.5,
                  maxWidth: '160px',
                  '& .MuiChip-label': {
                    px: 0.75,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  flexWrap: 'wrap',
                }}
              >
                <Box
                  sx={{
                    width: 4,
                    height: 4,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.text.secondary, 0.4),
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.7rem',
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                  }}
                >
                  Trivia
                </Typography>

                {entry.pointsEarned !== undefined && (
                  <>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.text.secondary, 0.4),
                      }}
                    />
                    <Chip
                      label={`+${entry.pointsEarned} PTS`}
                      size="small"
                      sx={{
                        bgcolor: entry.correct
                          ? alpha(theme.palette.success.main, 0.1)
                          : alpha(theme.palette.error.main, 0.1),
                        color: entry.correct
                          ? theme.palette.success.main
                          : theme.palette.error.main,
                        fontSize: '0.65rem',
                        height: 20,
                        fontWeight: 700,
                        borderRadius: 1.5,
                        border: `1px solid ${entry.correct ? alpha(theme.palette.success.main, 0.2) : alpha(theme.palette.error.main, 0.2)}`,
                        '& .MuiChip-label': {
                          px: 0.5,
                        },
                      }}
                    />
                  </>
                )}

                {entry.difficulty && (
                  <>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.text.secondary, 0.4),
                      }}
                    />
                    <Chip
                      label={entry.difficulty.toUpperCase()}
                      size="small"
                      sx={{
                        bgcolor: alpha(getDifficultyColor(entry.difficulty), 0.12),
                        color: getDifficultyColor(entry.difficulty),
                        fontSize: '0.65rem',
                        height: 20,
                        fontWeight: 700,
                        borderRadius: 1.5,
                        border: `1px solid ${alpha(getDifficultyColor(entry.difficulty), 0.2)}`,
                        '& .MuiChip-label': {
                          px: 0.5,
                        },
                      }}
                    />
                  </>
                )}

                {entry.isCasinoRush && !isGrouped && (
                  <>
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.text.secondary, 0.4),
                      }}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        fontWeight: 600,
                        color: entry.correct
                          ? theme.palette.warning.main
                          : theme.palette.error.main,
                      }}
                    >
                      {entry.correct
                        ? `🎰 ${entry.questionNumber}/${entry.totalQuestions}`
                        : '🎰 BUST'}
                    </Typography>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: 2, pb: 1.5 }}>
        <Box>
          {/* Category - if available */}
          {entry.category && (
            <Box sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  backgroundColor: alpha(
                    entry.isCasinoRush ? theme.palette.warning.main : entry.color,
                    0.08,
                  ),
                  borderRadius: 2,
                  px: 1.5,
                  py: 0.5,
                  border: `1px solid ${alpha(
                    entry.isCasinoRush ? theme.palette.warning.main : entry.color,
                    0.2,
                  )}`,
                }}
              >
                {entry.isCasinoRush ? (
                  <CasinoIcon
                    sx={{
                      fontSize: '1rem',
                      mr: 0.5,
                      color: theme.palette.warning.main,
                    }}
                  />
                ) : (
                  <SchoolIcon sx={{ fontSize: '1rem', mr: 0.5, color: entry.color }} />
                )}
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: '0.75rem',
                    color: entry.isCasinoRush ? theme.palette.warning.main : entry.color,
                    lineHeight: 1.3,
                    fontWeight: 600,
                    letterSpacing: '0.3px',
                  }}
                >
                  {entry.isCasinoRush ? `Casino Rush - ${entry.category}` : entry.category}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Question */}
          <Box
            onClick={() => setShowAnswerDialog(true)}
            sx={{
              mb: 1.5,
              borderRadius: 2,
              overflow: 'hidden',
              background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.primary.main, 0.04)} 100%)`,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              '&:hover': {
                transform: 'translateY(-1px)',
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.15)}`,
                borderColor: alpha(theme.palette.primary.main, 0.2),
              },
            }}
          >
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: theme.palette.primary.main,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {isGrouped && entry.questionNumber && entry.totalQuestions
                  ? `Question ${entry.questionNumber}/${entry.totalQuestions}`
                  : 'Question'}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, pt: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  mb: 0.75,
                }}
              >
                {entry.question}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  color: alpha(theme.palette.primary.main, 0.7),
                  display: 'flex',
                  alignItems: 'center',
                  fontStyle: 'italic',
                }}
              >
                Click to view all answer choices
              </Typography>
            </Box>
          </Box>

          {/* Answer */}
          <Box
            sx={{
              borderRadius: 2,
              overflow: 'hidden',
              background: entry.correct
                ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.08)} 0%, ${alpha(theme.palette.success.main, 0.04)} 100%)`
                : `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.08)} 0%, ${alpha(theme.palette.error.main, 0.04)} 100%)`,
              border: `1px solid ${
                entry.correct
                  ? alpha(theme.palette.success.main, 0.15)
                  : alpha(theme.palette.error.main, 0.15)
              }`,
            }}
          >
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                bgcolor: entry.correct
                  ? alpha(theme.palette.success.main, 0.08)
                  : alpha(theme.palette.error.main, 0.08),
                borderBottom: `1px solid ${
                  entry.correct
                    ? alpha(theme.palette.success.main, 0.15)
                    : alpha(theme.palette.error.main, 0.15)
                }`,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: entry.correct ? theme.palette.success.main : theme.palette.error.main,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {entry.correct ? 'Correct Answer' : 'Your Answer'}
              </Typography>
            </Box>
            <Box sx={{ p: 1.5, pt: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontSize: '0.8rem',
                  lineHeight: 1.6,
                  color: theme.palette.text.primary,
                  fontWeight: 500,
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  mb: !entry.correct ? 0.75 : 0,
                }}
              >
                {entry.selectedAnswer}
              </Typography>
              {!entry.correct && (
                <Box
                  sx={{
                    mt: 0.75,
                    p: 1,
                    bgcolor: alpha(theme.palette.success.main, 0.08),
                    borderRadius: 1,
                    borderLeft: `3px solid ${theme.palette.success.main}`,
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.7rem',
                      color: theme.palette.success.main,
                      fontWeight: 600,
                      display: 'block',
                      mb: 0.25,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Correct Answer
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.75rem',
                      color: theme.palette.text.primary,
                      fontWeight: 500,
                    }}
                  >
                    {entry.answer}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          {/* Badges/chips */}
          {entry.streak && entry.streak > 1 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                mt: 1.5,
                gap: 0.5,
                flexWrap: 'wrap',
              }}
            >
              <Chip
                size="small"
                label={`🔥 ${entry.streak} Day Streak`}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  bgcolor: alpha(theme.palette.warning.main, 0.12),
                  color: theme.palette.warning.main,
                  fontWeight: 600,
                  px: 1,
                }}
              />
            </Box>
          )}
          {children}
        </Box>
      </Box>

      {/* Answer Result Dialog */}
      <AnswerResultDialog
        open={showAnswerDialog}
        onClose={() => setShowAnswerDialog(false)}
        question={{
          question: entry.question,
          choices: entry.choices,
          answer: entry.answer,
          category: entry.category || '',
          difficulty: entry.difficulty || 'normal',
        }}
        selected={entry.selectedAnswer}
        isCorrect={entry.correct}
        streak={entry.streak}
        pointsEarned={entry.pointsEarned}
      />
    </>
  );

  if (wrapWithCard) {
    const customCategoryColor = '#9C27B0'; // Purple for custom categories

    return (
      <Box sx={{ position: 'relative', width: '100%' }}>
        {/* Custom Category Banner */}
        {entry.isCustomCategory && <CustomCategoryBanner />}

        <Card
          elevation={0}
          sx={{
            mt: entry.isCustomCategory ? 2 : 0,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            bgcolor: 'background.paper',
            transition: 'all 0.2s ease',
            borderLeft: `3px solid ${entry.isCustomCategory ? customCategoryColor : entry.color}`,
            position: 'relative',
            overflow: 'visible',
            '&:hover': {
              boxShadow: `0 4px 12px ${alpha(
                entry.isCustomCategory ? customCategoryColor : theme.palette.common.black,
                0.08,
              )}`,
              transform: 'translateY(-2px)',
            },
            ...(entry.isCustomCategory && {
              border: `1px solid ${alpha(customCategoryColor, 0.2)}`,
              boxShadow: `0 0 12px ${alpha(customCategoryColor, 0.1)}`,
            }),
          }}
        >
          {cardContent}
        </Card>
      </Box>
    );
  }

  return cardContent;
};

// Helper function
const getDifficultyColor = (difficulty?: 'easy' | 'normal' | 'hard') => {
  const DIFFICULTY_COLORS = {
    easy: '#66bb6a',
    normal: '#42a5f5',
    hard: '#ef5350',
  };
  if (!difficulty) return DIFFICULTY_COLORS.normal;
  return DIFFICULTY_COLORS[difficulty] || DIFFICULTY_COLORS.normal;
};

export default TimelineCard;
