// File: frontend/src/components/Leaderboard/PlayerCard.tsx
import BoltIcon from '@mui/icons-material/Bolt';
import CancelIcon from '@mui/icons-material/Cancel';
import CasinoIcon from '@mui/icons-material/Casino';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Card,
  Box,
  Typography,
  Avatar,
  Chip,
  useTheme,
  useMediaQuery,
  IconButton,
  Collapse,
  LinearProgress,
  Theme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState } from 'react';

import CategoryChip from './CategoryChip';
import DifficultyBreakdown, { DifficultyStats } from './DifficultyBreakdown';
import {
  getTopCategory,
  getCategoryData,
  formatTimestamp,
  computePoints,
  QuestionHistory,
  LeaderboardEntry,
  PointBreakdown,
} from './utils';
import { getUserColor, getUserInitials } from '../../utils';
import { getCategoryColor, isCustomCategory } from '../../utils/categoryUtils';

/** Compact stacked bar showing point sources */
const BREAKDOWN_SEGMENTS: Array<{
  key: keyof PointBreakdown;
  label: string;
  color: string;
}> = [
  { key: 'regularPoints', label: 'Trivia', color: '#1976d2' },
  { key: 'gameModePoints', label: 'Games', color: '#7b1fa2' },
  { key: 'arcadeBonusPoints', label: 'Arcade', color: '#f57c00' },
  { key: 'familyFeudPoints', label: 'Feud', color: '#388e3c' },
];

const PointBreakdownBar: React.FC<{ breakdown: PointBreakdown; theme: Theme }> = ({ breakdown, theme }) => {
  const total = breakdown.regularPoints + breakdown.gameModePoints + breakdown.arcadeBonusPoints + breakdown.familyFeudPoints;
  if (total <= 0) return null;

  const segments = BREAKDOWN_SEGMENTS
    .map(s => ({ ...s, value: breakdown[s.key] }))
    .filter(s => s.value > 0);

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.5, color: theme.palette.text.secondary }}>
        Point Sources
      </Typography>
      {/* Stacked bar */}
      <Box sx={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: alpha(theme.palette.divider, 0.08) }}>
        {segments.map(s => (
          <Box
            key={s.key}
            sx={{
              width: `${(s.value / total) * 100}%`,
              bgcolor: s.color,
              minWidth: s.value > 0 ? 3 : 0,
            }}
          />
        ))}
      </Box>
      {/* Legend chips */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {segments.map(s => (
          <Chip
            key={s.key}
            size="small"
            label={`${s.label} ${s.value % 1 === 0 ? s.value : s.value.toFixed(1)}`}
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 700,
              bgcolor: s.color,
              color: 'white',
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

interface ExtendedQuestionHistory extends QuestionHistory {
  isCasinoRush?: boolean;
  questionNumber?: number;
  totalQuestions?: number;
}

interface PlayerCardProps {
  player: LeaderboardEntry;
  rank: number;
  isCurrentUser: boolean;
  onViewProfile?: (userId: string) => void;
  maxQuestionsAsked?: number;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, rank, isCurrentUser, onViewProfile, maxQuestionsAsked }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);

  const topCategory = getTopCategory(player.categoryScores);
  const categoryData = getCategoryData(player.categoryScores);
  const difficultyStats: DifficultyStats = player.difficultyStats
    ? player.difficultyStats
    : { easy: 0, normal: 0, hard: 0, total: 0 };
  const breakdown = player.pointBreakdown;

  const rankColor =
    rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : undefined;

  const questionsProgress = (player.questionsAnswered != null && maxQuestionsAsked != null && maxQuestionsAsked > 0)
    ? (player.questionsAnswered / maxQuestionsAsked) * 100
    : null;

  const lastAnswer = player.lastAnswer;
  const lastAnswerExt = lastAnswer as ExtendedQuestionHistory | undefined;
  const pointsEarned = lastAnswer ? computePoints(lastAnswer as QuestionHistory) : 0;

  return (
    <Card
      elevation={0}
      onClick={() => onViewProfile?.(player.userId)}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        cursor: onViewProfile ? 'pointer' : 'default',
        border: isCurrentUser
          ? `2px solid ${theme.palette.primary.main}`
          : `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        bgcolor: theme.palette.background.paper,
        transition: 'all 0.15s ease',
        '&:hover': {
          boxShadow: `0 4px 20px ${alpha('#000', 0.08)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
        },
        '&:active': { transform: 'scale(0.995)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: { xs: 1.25, sm: 1.5 }, gap: { xs: 1.25, sm: 1.5 } }}>
        {/* Rank number */}
        <Typography sx={{
          fontWeight: 800,
          fontSize: rank <= 3 ? '1.1rem' : '0.85rem',
          minWidth: 24,
          textAlign: 'center',
          color: rankColor || theme.palette.text.disabled,
          ...(rank <= 3 && {
            textShadow: `0 1px 3px ${alpha(rankColor!, 0.4)}`,
          }),
        }}>
          {rank}
        </Typography>

        {/* Avatar */}
        <Avatar
          sx={{
            width: { xs: 42, sm: 48 },
            height: { xs: 42, sm: 48 },
            bgcolor: getUserColor(player.userId),
            fontWeight: 700,
            fontSize: { xs: '0.9rem', sm: '1rem' },
            boxShadow: `0 2px 8px ${alpha(getUserColor(player.userId), 0.35)}`,
            ...(rank <= 3 && {
              border: `2px solid ${rankColor}`,
            }),
          }}
        >
          {getUserInitials(player.userId)}
        </Avatar>

        {/* Name + stats */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.9rem', sm: '0.95rem' }, lineHeight: 1.2 }} noWrap>
              {player.userId}
            </Typography>
            {player.streak > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2, flexShrink: 0 }}>
                <BoltIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
                <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', color: theme.palette.warning.dark }}>
                  {player.streak}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Score + accuracy + category */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Typography sx={{
              fontWeight: 800,
              fontSize: { xs: '1rem', sm: '1.15rem' },
              color: theme.palette.primary.main,
              lineHeight: 1,
            }}>
              {typeof player.score === 'number' ? player.score.toFixed(1) : player.score}
            </Typography>

            {player.accuracy !== undefined && (
              <Typography sx={{
                fontWeight: 600, fontSize: '0.7rem',
                color: player.accuracy >= 70 ? theme.palette.success.main
                  : player.accuracy >= 50 ? theme.palette.warning.main
                  : theme.palette.error.main,
              }}>
                {player.accuracy}%
              </Typography>
            )}

            {topCategory && (
              <Chip
                label={isCustomCategory(topCategory) ? 'Custom' : topCategory.split(' ')[0]}
                size="small"
                sx={{
                  height: 18, fontSize: '0.55rem', fontWeight: 700,
                  bgcolor: topCategory === 'Custom' || isCustomCategory(topCategory)
                    ? '#9C27B0' : getCategoryColor(topCategory),
                  color: 'white',
                }}
              />
            )}
          </Box>

          {/* Point breakdown bar — always visible */}
          {breakdown && (
            <Box sx={{ mt: 0.5 }}>
              <Box sx={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', bgcolor: alpha(theme.palette.divider, 0.08) }}>
                {BREAKDOWN_SEGMENTS
                  .map(s => ({ ...s, value: breakdown[s.key] }))
                  .filter(s => s.value > 0)
                  .map(s => {
                    const total = breakdown.regularPoints + breakdown.gameModePoints + breakdown.arcadeBonusPoints + breakdown.familyFeudPoints;
                    return (
                      <Box key={s.key} sx={{ width: `${(s.value / total) * 100}%`, bgcolor: s.color, minWidth: 2 }} />
                    );
                  })}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.4, mt: 0.3, flexWrap: 'wrap' }}>
                {BREAKDOWN_SEGMENTS
                  .map(s => ({ ...s, value: breakdown[s.key] }))
                  .filter(s => s.value > 0)
                  .map(s => (
                    <Typography key={s.key} sx={{ fontSize: '0.5rem', fontWeight: 700, color: s.color }}>
                      {s.label} {s.value % 1 === 0 ? s.value : s.value.toFixed(1)}
                    </Typography>
                  ))}
              </Box>
            </Box>
          )}

          {/* Progress bar */}
          {questionsProgress !== null && (
            <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <LinearProgress
                variant="determinate"
                value={Math.min(questionsProgress, 100)}
                sx={{
                  flex: 1, height: 3, borderRadius: 2,
                  bgcolor: alpha(theme.palette.divider, 0.08),
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 2,
                    bgcolor: questionsProgress >= 100
                      ? theme.palette.success.main
                      : theme.palette.primary.light,
                  },
                }}
              />
              <Typography sx={{ fontSize: '0.55rem', color: theme.palette.text.disabled, fontWeight: 600, flexShrink: 0 }}>
                {player.questionsAnswered}/{maxQuestionsAsked}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Expand toggle */}
        {(categoryData.length > 0 || difficultyStats.total > 0 || breakdown) && (
          <IconButton
            onClick={(e) => { e.stopPropagation(); setExpanded((ex) => !ex); }}
            size="small"
            sx={{ color: theme.palette.text.disabled, p: 0.5 }}
          >
            {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </IconButton>
        )}
      </Box>

      {/* Expanded section */}
      {(categoryData.length > 0 || difficultyStats.total > 0 || breakdown) && (
        <Collapse in={expanded}>
          <Box
            sx={{
              px: { xs: 1.5, sm: 2 }, pb: 1.5, pt: 0.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Point breakdown */}
            {breakdown && (
              <PointBreakdownBar breakdown={breakdown} theme={theme} />
            )}
            <DifficultyBreakdown stats={difficultyStats} />
            {categoryData.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.5, color: theme.palette.text.secondary }}>
                  Categories
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {categoryData.map(({ name, value }) => (
                    <CategoryChip key={name} category={name} score={value} size={isMobile ? 'small' : 'medium'} />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      )}

      {/* Last answer — full detail */}
      {lastAnswer && (
        <Box
          sx={{
            px: { xs: 1.25, sm: 1.5 }, py: 1,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            bgcolor: alpha(lastAnswer.correct ? theme.palette.success.main : theme.palette.error.main, 0.03),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75 }}>
            {lastAnswer.correct ? (
              <CheckCircleIcon sx={{ fontSize: 16, color: theme.palette.success.main, mt: 0.2 }} />
            ) : (
              <CancelIcon sx={{ fontSize: 16, color: theme.palette.error.main, mt: 0.2 }} />
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.4, color: theme.palette.text.primary }}>
                {lastAnswerExt?.isCasinoRush && (
                  <CasinoIcon sx={{ fontSize: '0.8rem', verticalAlign: 'middle', mr: 0.5, color: theme.palette.warning.main }} />
                )}
                {lastAnswer.question.question}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}>
                <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.secondary }}>
                  Answered: <b>{lastAnswer.selectedAnswer}</b>
                </Typography>
                {!lastAnswer.correct && (
                  <Typography sx={{ fontSize: '0.62rem', color: theme.palette.error.main }}>
                    Correct: <b>{lastAnswer.question.answer}</b>
                  </Typography>
                )}
                {lastAnswer.correct && pointsEarned > 0 && (
                  <Typography sx={{ fontSize: '0.62rem', color: theme.palette.success.main, fontWeight: 700 }}>
                    +{pointsEarned} {pointsEarned === 1 ? 'pt' : 'pts'}
                  </Typography>
                )}
                <Typography sx={{ fontSize: '0.55rem', color: theme.palette.text.disabled, ml: 'auto' }}>
                  {formatTimestamp(lastAnswer.timestamp)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Card>
  );
};

export default PlayerCard;
