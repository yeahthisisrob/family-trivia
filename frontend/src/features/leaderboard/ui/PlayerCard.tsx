import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Card,
  Chip,
  Collapse,
  IconButton,
  type Theme,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type React from 'react';
import { useState } from 'react';
import type { PlayerResult } from '../../../entities/leaderboard';
import { PersonAvatar } from '../../../entities/person';
import { gameOf } from '../../../games/registry';
import { colors as dsColors } from '../../../shared/design-system/tokens/colors';
import { getUserColor, getUserInitials } from '../../../utils';
import { getCategoryColor, isCustomCategory } from '../../../utils/categoryUtils';
import {
  computePoints,
  formatTimestamp,
  getCategoryData,
  getTopCategory,
  type PointBreakdown,
} from '../model/utils';
import CategoryChip from './CategoryChip';
import DifficultyBreakdown, { type DifficultyStats } from './DifficultyBreakdown';

/** Compact stacked bar showing point sources */
const BREAKDOWN_SEGMENTS: Array<{
  key: keyof PointBreakdown;
  label: string;
  color: string;
}> = [
  { key: 'regularPoints', label: 'Trivia', color: dsColors.accent.blue },
  { key: 'gameModePoints', label: 'Games', color: dsColors.accent.purple },
  { key: 'arcadeBonusPoints', label: 'Arcade', color: dsColors.accent.orange },
  { key: 'familyFeudPoints', label: 'Feud', color: dsColors.accent.green },
];

const PointBreakdownBar: React.FC<{ breakdown: PointBreakdown; theme: Theme }> = ({
  breakdown,
  theme,
}) => {
  const total =
    breakdown.regularPoints +
    breakdown.gameModePoints +
    breakdown.arcadeBonusPoints +
    breakdown.familyFeudPoints;
  if (total <= 0) return null;

  const segments = BREAKDOWN_SEGMENTS.map((s) => ({ ...s, value: breakdown[s.key] })).filter(
    (s) => s.value > 0,
  );

  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography
        sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.5, color: theme.palette.text.secondary }}
      >
        Point Sources
      </Typography>
      {/* Stacked bar */}
      <Box
        sx={{
          display: 'flex',
          height: 6,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: alpha(theme.palette.divider, 0.08),
        }}
      >
        {segments.map((s) => (
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
        {segments.map((s) => (
          <Chip
            key={s.key}
            size="small"
            label={`${s.label} ${s.value % 1 === 0 ? s.value : s.value.toFixed(1)}`}
            sx={{
              height: 18,
              fontSize: '0.55rem',
              fontWeight: 700,
              bgcolor: s.color,
              color: dsColors.onColor,
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

interface PlayerCardProps {
  player: PlayerResult;
  rank: number;
  isCurrentUser: boolean;
  onViewProfile?: (userId: string) => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ player, rank, isCurrentUser, onViewProfile }) => {
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
    rank === 1
      ? dsColors.medal.gold
      : rank === 2
        ? dsColors.medal.silver
        : rank === 3
          ? dsColors.medal.bronze
          : undefined;

  const lastAnswer = player.lastAnswer;
  // A session game's answer shows the game's icon (its folder, 0032).
  const lastGame = gameOf(lastAnswer as never);
  const LastGameIcon = lastGame?.session ? lastGame.icon : undefined;
  const pointsEarned = lastAnswer ? computePoints(lastAnswer) : 0;

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
          boxShadow: `0 4px 20px ${alpha(dsColors.scrim, 0.08)}`,
          borderColor: alpha(theme.palette.primary.main, 0.3),
        },
        '&:active': { transform: 'scale(0.995)' },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: { xs: 1.25, sm: 1.5 },
          gap: { xs: 1.25, sm: 1.5 },
        }}
      >
        {/* Rank number */}
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: rank <= 3 ? '1.1rem' : '0.85rem',
            minWidth: 24,
            textAlign: 'center',
            color: rankColor || theme.palette.text.disabled,
            ...(rank <= 3 &&
              rankColor && {
                textShadow: `0 1px 3px ${alpha(rankColor, 0.4)}`,
              }),
          }}
        >
          {rank}
        </Typography>

        {/* Avatar */}
        <PersonAvatar
          personId={player.userId}
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
        </PersonAvatar>

        {/* Name + stats */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
            <Typography
              sx={{ fontWeight: 700, fontSize: { xs: '0.9rem', sm: '0.95rem' }, lineHeight: 1.2 }}
              noWrap
            >
              {player.userId}
            </Typography>
          </Box>

          {/* Score + accuracy + category */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1rem', sm: '1.15rem' },
                color: theme.palette.primary.main,
                lineHeight: 1,
              }}
            >
              {typeof player.score === 'number' ? player.score.toFixed(1) : player.score}
            </Typography>

            {player.accuracy !== undefined && (
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  color:
                    player.accuracy >= 70
                      ? theme.palette.success.main
                      : player.accuracy >= 50
                        ? theme.palette.warning.main
                        : theme.palette.error.main,
                }}
              >
                {player.accuracy}%
              </Typography>
            )}

            {topCategory && (
              <Chip
                label={isCustomCategory(topCategory) ? 'Custom' : topCategory.split(' ')[0]}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.55rem',
                  fontWeight: 700,
                  bgcolor:
                    topCategory === 'Custom' || isCustomCategory(topCategory)
                      ? dsColors.category.custom
                      : getCategoryColor(topCategory),
                  color: dsColors.onColor,
                }}
              />
            )}
          </Box>

          {/* Point breakdown bar — always visible */}
          {breakdown && (
            <Box sx={{ mt: 0.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  height: 4,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: alpha(theme.palette.divider, 0.08),
                }}
              >
                {BREAKDOWN_SEGMENTS.map((s) => ({ ...s, value: breakdown[s.key] }))
                  .filter((s) => s.value > 0)
                  .map((s) => {
                    const total =
                      breakdown.regularPoints +
                      breakdown.gameModePoints +
                      breakdown.arcadeBonusPoints +
                      breakdown.familyFeudPoints;
                    return (
                      <Box
                        key={s.key}
                        sx={{ width: `${(s.value / total) * 100}%`, bgcolor: s.color, minWidth: 2 }}
                      />
                    );
                  })}
              </Box>
              <Box sx={{ display: 'flex', gap: 0.4, mt: 0.3, flexWrap: 'wrap' }}>
                {BREAKDOWN_SEGMENTS.map((s) => ({ ...s, value: breakdown[s.key] }))
                  .filter((s) => s.value > 0)
                  .map((s) => (
                    <Typography
                      key={s.key}
                      sx={{ fontSize: '0.5rem', fontWeight: 700, color: s.color }}
                    >
                      {s.label} {s.value % 1 === 0 ? s.value : s.value.toFixed(1)}
                    </Typography>
                  ))}
              </Box>
            </Box>
          )}

          {/* What's still to play: a late start never looks like losing (0016) */}
          {!!player.stillToPlay && (
            <Typography
              sx={{ mt: 0.5, fontSize: '0.7rem', color: 'text.secondary', fontWeight: 600 }}
            >
              {player.stillToPlay} still to play
            </Typography>
          )}
        </Box>

        {/* Expand toggle */}
        {(categoryData.length > 0 || difficultyStats.total > 0 || breakdown) && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((ex) => !ex);
            }}
            size="small"
            sx={{ color: theme.palette.text.disabled, p: 0.5 }}
          >
            {expanded ? (
              <ExpandLessIcon sx={{ fontSize: 18 }} />
            ) : (
              <ExpandMoreIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        )}
      </Box>

      {/* Expanded section */}
      {(categoryData.length > 0 || difficultyStats.total > 0 || breakdown) && (
        <Collapse in={expanded}>
          <Box
            sx={{
              px: { xs: 1.5, sm: 2 },
              pb: 1.5,
              pt: 0.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Point breakdown */}
            {breakdown && <PointBreakdownBar breakdown={breakdown} theme={theme} />}
            <DifficultyBreakdown stats={difficultyStats} />
            {categoryData.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    mb: 0.5,
                    color: theme.palette.text.secondary,
                  }}
                >
                  Categories
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {categoryData.map(({ name, value }) => (
                    <CategoryChip
                      key={name}
                      category={name}
                      score={value}
                      size={isMobile ? 'small' : 'medium'}
                    />
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
            px: { xs: 1.25, sm: 1.5 },
            py: 1,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
            bgcolor: alpha(
              lastAnswer.correct ? theme.palette.success.main : theme.palette.error.main,
              0.03,
            ),
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
              <Typography
                sx={{ fontSize: '0.72rem', lineHeight: 1.4, color: theme.palette.text.primary }}
              >
                {LastGameIcon && (
                  <LastGameIcon
                    sx={{
                      fontSize: '0.8rem',
                      verticalAlign: 'middle',
                      mr: 0.5,
                      color: lastGame?.look.frame ?? lastGame?.look.accent,
                    }}
                  />
                )}
                {lastAnswer.question.question}
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  mt: 0.25,
                  flexWrap: 'wrap',
                }}
              >
                <Typography sx={{ fontSize: '0.62rem', color: theme.palette.text.secondary }}>
                  Answered: <b>{lastAnswer.selectedAnswer}</b>
                </Typography>
                {!lastAnswer.correct && (
                  <Typography sx={{ fontSize: '0.62rem', color: theme.palette.error.main }}>
                    Correct: <b>{lastAnswer.question.answer}</b>
                  </Typography>
                )}
                {lastAnswer.correct && pointsEarned > 0 && (
                  <Typography
                    sx={{ fontSize: '0.62rem', color: theme.palette.success.main, fontWeight: 700 }}
                  >
                    +{pointsEarned} {pointsEarned === 1 ? 'pt' : 'pts'}
                  </Typography>
                )}
                <Typography
                  sx={{ fontSize: '0.55rem', color: theme.palette.text.disabled, ml: 'auto' }}
                >
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
