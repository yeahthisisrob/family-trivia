// File: frontend/src/components/Leaderboard/GroupCard.tsx
import BoltIcon from '@mui/icons-material/Bolt';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import {
  Card,
  Box,
  Typography,
  Avatar,
  useTheme,
  IconButton,
  Collapse,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState, useMemo } from 'react';

import CategoryChip from './CategoryChip';
import DifficultyBreakdown, { DifficultyStats } from './DifficultyBreakdown';
import {
  LeaderboardEntry,
  GroupScore,
  PointBreakdown,
  calculateCategoryScores,
  getCategoryData,
  calculateAdjustedGroupAverage,
} from './utils';
import { colors as dsColors } from '../../shared/design-system/tokens/colors';
import { getUserColor, getUserInitials } from '../../utils';

interface GroupCardProps {
  group: GroupScore;
  groupPlayers: LeaderboardEntry[];
  rank: number;
  groupCategories?: Record<string, number>;
  topGroupCategory?: string;
  onViewProfile?: (userId: string) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({
  group,
  groupPlayers,
  rank,
  groupCategories,
  topGroupCategory: _topGroupCategory,
  onViewProfile,
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const groupDesc = group.description;
  const adjustedAverage = useMemo(
    () => group.averageScore ?? calculateAdjustedGroupAverage(groupPlayers),
    [group.averageScore, groupPlayers],
  );
  const activeMembers = useMemo(
    () => group.activeMemberCount ?? groupPlayers.filter((p) => p.lastAnswer !== undefined).length,
    [group.activeMemberCount, groupPlayers],
  );

  const rankColor =
    rank === 1 ? dsColors.medal.gold : rank === 2 ? dsColors.medal.silver : rank === 3 ? dsColors.medal.bronze : undefined;

  const aggregatedStats = useMemo(() => {
    if (group.difficultyStats) return group.difficultyStats as DifficultyStats;
    const combined = { easy: 0, normal: 0, hard: 0, total: 0 };
    groupPlayers.forEach((player) => {
      if (player.difficultyStats) {
        combined.easy += player.difficultyStats.easy || 0;
        combined.normal += player.difficultyStats.normal || 0;
        combined.hard += player.difficultyStats.hard || 0;
        combined.total += player.difficultyStats.total || 0;
      }
    });
    return combined as DifficultyStats;
  }, [group.difficultyStats, groupPlayers]);

  const categoryMap = groupCategories
    ? groupCategories
    : calculateCategoryScores(groupPlayers.flatMap((p) => (p.lastAnswer ? [p.lastAnswer] : [])));
  const categories = getCategoryData(categoryMap);

  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.15s ease',
        '&:hover': {
          boxShadow: `0 4px 20px ${alpha('#000', 0.08)}`,
          borderColor: alpha(theme.palette.primary.main, 0.2),
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: { xs: 1.25, sm: 1.5 }, gap: { xs: 1.25, sm: 1.5 } }}>
        {/* Rank */}
        <Typography sx={{
          fontWeight: 800,
          fontSize: rank <= 3 ? '1.1rem' : '0.85rem',
          minWidth: 24,
          textAlign: 'center',
          color: rankColor || theme.palette.text.disabled,
          ...(rank <= 3 && rankColor && {
            textShadow: `0 1px 3px ${alpha(rankColor, 0.4)}`,
          }),
        }}>
          {rank}
        </Typography>

        {/* Group avatar */}
        <Avatar sx={{
          width: { xs: 42, sm: 48 },
          height: { xs: 42, sm: 48 },
          bgcolor: theme.palette.primary.main,
          ...(rank <= 3 && rankColor && {
            border: `2px solid ${rankColor}`,
            boxShadow: `0 2px 8px ${alpha(rankColor, 0.3)}`,
          }),
        }}>
          <GroupIcon sx={{ fontSize: { xs: 22, sm: 26 } }} />
        </Avatar>

        {/* Name + stats */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: { xs: '0.9rem', sm: '0.95rem' }, lineHeight: 1.2 }} noWrap>
            {group.groupId}
          </Typography>

          {groupDesc && (
            <Typography sx={{
              fontSize: '0.65rem', color: theme.palette.text.secondary,
              lineHeight: 1.3, mt: 0.15,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {groupDesc.description}
            </Typography>
          )}

          {/* Score + members + accuracy */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
            <Typography sx={{
              fontWeight: 800,
              fontSize: { xs: '1rem', sm: '1.15rem' },
              color: theme.palette.primary.main,
              lineHeight: 1,
            }}>
              {adjustedAverage.toFixed(1)}
              <Typography component="span" sx={{ fontSize: '0.55rem', fontWeight: 600, ml: 0.3, color: theme.palette.text.secondary }}>
                avg
              </Typography>
            </Typography>

            <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.secondary }}>
              {activeMembers}/{group.memberCount}
            </Typography>

            {group.accuracy !== undefined && (
              <Typography sx={{
                fontWeight: 600, fontSize: '0.7rem',
                color: group.accuracy >= 70 ? theme.palette.success.main
                  : group.accuracy >= 50 ? theme.palette.warning.main
                  : theme.palette.error.main,
              }}>
                {group.accuracy}%
              </Typography>
            )}
          </Box>

          {/* Aggregated point breakdown */}
          {(() => {
            const agg: PointBreakdown = { regularPoints: 0, gameModePoints: 0, arcadeBonusPoints: 0, familyFeudPoints: 0 };
            for (const p of groupPlayers) {
              if (p.pointBreakdown) {
                agg.regularPoints += p.pointBreakdown.regularPoints;
                agg.gameModePoints += p.pointBreakdown.gameModePoints;
                agg.arcadeBonusPoints += p.pointBreakdown.arcadeBonusPoints;
                agg.familyFeudPoints += p.pointBreakdown.familyFeudPoints;
              }
            }
            const total = agg.regularPoints + agg.gameModePoints + agg.arcadeBonusPoints + agg.familyFeudPoints;
            if (total <= 0) return null;
            const segs = [
              { key: 'r', label: 'Trivia', color: '#1976d2', value: agg.regularPoints },
              { key: 'g', label: 'Games', color: '#7b1fa2', value: agg.gameModePoints },
              { key: 'a', label: 'Arcade', color: '#f57c00', value: agg.arcadeBonusPoints },
              { key: 'f', label: 'Feud', color: '#388e3c', value: agg.familyFeudPoints },
            ].filter(s => s.value > 0);
            return (
              <Box sx={{ mt: 0.5 }}>
                <Box sx={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', bgcolor: alpha(theme.palette.divider, 0.08) }}>
                  {segs.map(s => (
                    <Box key={s.key} sx={{ width: `${(s.value / total) * 100}%`, bgcolor: s.color, minWidth: 2 }} />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 0.4, mt: 0.3, flexWrap: 'wrap' }}>
                  {segs.map(s => (
                    <Typography key={s.key} sx={{ fontSize: '0.5rem', fontWeight: 700, color: s.color }}>
                      {s.label} {s.value % 1 === 0 ? s.value : s.value.toFixed(1)}
                    </Typography>
                  ))}
                </Box>
              </Box>
            );
          })()}
        </Box>

        {/* Expand */}
        <IconButton
          onClick={() => setExpanded((e) => !e)}
          size="small"
          sx={{ color: theme.palette.text.disabled, p: 0.5 }}
        >
          {expanded ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      {/* Expanded */}
      <Collapse in={expanded}>
        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.06)}` }}>
          {/* Difficulty */}
          {aggregatedStats.total > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <DifficultyBreakdown stats={aggregatedStats} />
            </Box>
          )}

          {/* Categories */}
          {categories.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.5, color: theme.palette.text.secondary }}>
                Categories
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {categories.map(({ name, value }) => (
                  <CategoryChip key={name} category={name} score={value} size="small" />
                ))}
              </Box>
            </Box>
          )}

          {/* Members */}
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.75, color: theme.palette.text.secondary }}>
              Members
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {[...groupPlayers].sort((a, b) => b.score - a.score).map((p) => (
                <Box
                  key={p.userId}
                  onClick={() => onViewProfile?.(p.userId)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    p: 0.75, borderRadius: 2,
                    cursor: onViewProfile ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                    '&:hover': onViewProfile ? { bgcolor: alpha(theme.palette.primary.main, 0.04) } : {},
                  }}
                >
                  <Avatar sx={{
                    width: 30, height: 30, fontSize: '0.7rem', fontWeight: 700,
                    bgcolor: getUserColor(p.userId),
                  }}>
                    {getUserInitials(p.userId)}
                  </Avatar>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.78rem', flex: 1 }} noWrap>
                    {p.userId}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', color: theme.palette.primary.main }}>
                      {typeof p.score === 'number' ? p.score.toFixed(1) : p.score}
                    </Typography>
                    {p.streak > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.15 }}>
                        <BoltIcon sx={{ fontSize: 12, color: theme.palette.warning.main }} />
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: theme.palette.warning.dark }}>
                          {p.streak}
                        </Typography>
                      </Box>
                    )}
                    {p.accuracy !== undefined && (
                      <Typography sx={{
                        fontSize: '0.6rem', fontWeight: 600,
                        color: p.accuracy >= 70 ? theme.palette.success.main
                          : p.accuracy >= 50 ? theme.palette.warning.main
                          : theme.palette.error.main,
                      }}>
                        {p.accuracy}%
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Collapse>
    </Card>
  );
};

export default GroupCard;
