// File: frontend/src/components/Profile/ScoreHistory.tsx
import {
  Close as CloseIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Casino as CasinoIcon,
  QuestionAnswer as QuizIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Chip,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  Paper,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import React, { useState, useMemo } from 'react';

interface ScoreHistoryEntry {
  date: string;
  gameType: string;
  category: string;
  difficulty: string;
  pointsAttempted: number;
  pointsEarned: number;
  correct: boolean;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  isCasinoRush: boolean;
  questionNumber?: number;
  totalQuestions?: number;
}

interface ScoreHistoryProps {
  open: boolean;
  onClose: () => void;
  scoringHistory: ScoreHistoryEntry[];
  totalScore: number;
}

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty?.toLowerCase()) {
    case 'easy':
      return '#4caf50';
    case 'hard':
      return '#f44336';
    default:
      return '#ff9800';
  }
};

export default function ScoreHistory({
  open,
  onClose,
  scoringHistory,
  totalScore,
}: ScoreHistoryProps) {
  const theme = useTheme();
  const [gameTypeFilter, setGameTypeFilter] = useState<string>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filteredHistory = useMemo(() => {
    if (gameTypeFilter === 'all') return scoringHistory;
    if (gameTypeFilter === 'casino') return scoringHistory.filter((h) => h.isCasinoRush);
    return scoringHistory.filter((h) => !h.isCasinoRush);
  }, [scoringHistory, gameTypeFilter]);

  const stats = useMemo(() => {
    const total = filteredHistory.length;
    const correct = filteredHistory.filter((h) => h.correct).length;
    const pointsEarned = filteredHistory.reduce((sum, h) => sum + h.pointsEarned, 0);
    const pointsAttempted = filteredHistory.reduce((sum, h) => sum + h.pointsAttempted, 0);
    const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : '0';

    return { total, correct, pointsEarned, pointsAttempted, accuracy };
  }, [filteredHistory]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingUpIcon color="primary" />
          <Typography variant="h6">Score History</Typography>
          <Chip
            label={`${totalScore} pts`}
            color="primary"
            size="small"
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {/* Filter and Stats */}
        <Box sx={{ p: 2, pb: 1 }}>
          <ToggleButtonGroup
            value={gameTypeFilter}
            exclusive
            onChange={(_, value) => value && setGameTypeFilter(value)}
            size="small"
            fullWidth
            sx={{ mb: 2 }}
          >
            <ToggleButton value="all">All Games</ToggleButton>
            <ToggleButton value="regular">
              <QuizIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Regular Trivia
            </ToggleButton>
            <ToggleButton value="casino">
              <CasinoIcon sx={{ mr: 0.5, fontSize: 18 }} />
              Casino Rush
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Stats Summary */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              borderRadius: 2,
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 2,
                textAlign: 'center',
              }}
            >
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Questions
                </Typography>
                <Typography variant="h6">{stats.total}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Accuracy
                </Typography>
                <Typography
                  variant="h6"
                  color={parseFloat(stats.accuracy) >= 70 ? 'success.main' : 'warning.main'}
                >
                  {stats.accuracy}%
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Points
                </Typography>
                <Typography variant="h6" color="primary">
                  {stats.pointsEarned}/{stats.pointsAttempted}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        <Divider />

        {/* History List */}
        <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
          {filteredHistory.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography color="text.secondary">No history for selected filter</Typography>
            </Box>
          ) : (
            filteredHistory.map((entry, index) => (
              <Box key={index}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    mx: 2,
                    my: 1,
                    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                    borderRadius: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.02),
                      borderColor: alpha(theme.palette.primary.main, 0.2),
                    },
                  }}
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  {/* Header Row */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: expandedIndex === index ? 1 : 0,
                    }}
                  >
                    {entry.correct ? (
                      <CheckIcon color="success" sx={{ fontSize: 20 }} />
                    ) : (
                      <CancelIcon color="error" sx={{ fontSize: 20 }} />
                    )}

                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {entry.category}
                        </Typography>
                        <Chip
                          label={entry.difficulty}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.75rem',
                            bgcolor: alpha(getDifficultyColor(entry.difficulty), 0.15),
                            color: getDifficultyColor(entry.difficulty),
                          }}
                        />
                        {entry.isCasinoRush && (
                          <Chip
                            icon={<CasinoIcon sx={{ fontSize: 14 }} />}
                            label={`${entry.questionNumber}/${entry.totalQuestions}`}
                            size="small"
                            color="secondary"
                            sx={{ height: 20, fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(entry.date)}
                      </Typography>
                    </Box>

                    <Box sx={{ textAlign: 'right' }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 'bold',
                          color: entry.correct ? 'success.main' : 'text.secondary',
                        }}
                      >
                        {entry.correct ? `+${entry.pointsEarned}` : '0'} pts
                      </Typography>
                      {!entry.correct && (
                        <Typography variant="caption" color="text.secondary">
                          of {entry.pointsAttempted}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Expanded Content */}
                  {expandedIndex === index && (
                    <Box
                      sx={{
                        mt: 2,
                        pt: 2,
                        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                      }}
                    >
                      <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                        &ldquo;{entry.question}&rdquo;
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Your Answer:
                          </Typography>
                          <Typography
                            variant="body2"
                            color={entry.correct ? 'success.main' : 'error.main'}
                          >
                            {entry.userAnswer || 'No answer'}
                          </Typography>
                        </Box>
                        {!entry.correct && (
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              Correct Answer:
                            </Typography>
                            <Typography variant="body2" color="success.main">
                              {entry.correctAnswer}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                </Paper>
              </Box>
            ))
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}
