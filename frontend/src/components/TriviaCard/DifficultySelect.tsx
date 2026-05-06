// File: src/components/TriviaCard/DifficultySelect.tsx
// Compact difficulty picker — shows after category select.

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SchoolIcon from '@mui/icons-material/School';
import SpeedIcon from '@mui/icons-material/Speed';
import {
  Box, Card, Typography, IconButton,
  alpha, useTheme,
} from '@mui/material';
import React from 'react';

import { colors } from '../../shared/design-system/tokens/colors';
import { radii } from '../../shared/design-system/tokens/radii';
import { shadows } from '../../shared/design-system/tokens/shadows';

export type Difficulty = 'easy' | 'normal' | 'hard';

const LEVELS: Array<{
  key: Difficulty;
  label: string;
  multiplier: string;
  description: string;
  color: string;
  icon: React.ReactElement;
}> = [
  { key: 'easy',   label: 'Casual',  multiplier: '½×', description: 'Everyday knowledge',  color: colors.difficulty.easy,   icon: <SchoolIcon /> },
  { key: 'normal', label: 'Classic', multiplier: '1×', description: 'Traditional challenge', color: colors.difficulty.normal, icon: <SpeedIcon /> },
  { key: 'hard',   label: 'Expert',  multiplier: '2×', description: 'Double or nothing',    color: colors.difficulty.hard,   icon: <PsychologyIcon /> },
];

interface DifficultySelectProps {
  category: string;
  onSelect: (difficulty: Difficulty) => void;
  onBack: () => void;
}

const DifficultySelect: React.FC<DifficultySelectProps> = ({ category, onSelect, onBack }) => {
  const theme = useTheme();

  return (
    <Card sx={{
      overflow: 'hidden', borderRadius: `${radii.xl}px`,
      boxShadow: shadows.card,
      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    }}>
      {/* Header with back button */}
      <Box sx={{
        px: 1.5, py: 1,
        display: 'flex', alignItems: 'center', gap: 0.5,
        background: `linear-gradient(135deg, ${alpha(colors.brand.primary, 0.06)}, transparent)`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
      }}>
        <IconButton onClick={onBack} size="small" sx={{ mr: 0.25, p: 0.25 }}>
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </IconButton>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', flex: 1 }}>
          {category}
        </Typography>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: colors.text.disabled, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Pick difficulty
        </Typography>
      </Box>

      {/* Difficulty buttons */}
      <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.6 }}>
        {LEVELS.map(({ key, label, multiplier, description, color, icon }) => (
          <Box
            key={key}
            onClick={() => onSelect(key)}
            sx={{
              py: 1, px: 1.25,
              borderRadius: `${radii.md}px`,
              border: `1.5px solid ${alpha(color, 0.3)}`,
              bgcolor: alpha(color, 0.05),
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 1.25,
              transition: 'all 0.15s',
              '@media (hover: hover)': {
                '&:hover': {
                  bgcolor: alpha(color, 0.12),
                  borderColor: color,
                  transform: 'translateX(2px)',
                },
              },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            <Box sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: '50%',
              bgcolor: alpha(color, 0.15), color,
              '& .MuiSvgIcon-root': { fontSize: '1.05rem' },
            }}>
              {icon}
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.2, color: theme.palette.text.primary }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: '0.66rem', color: colors.text.secondary, lineHeight: 1.2 }}>
                {description}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color, letterSpacing: 0.5 }}>
              {multiplier}
            </Typography>
          </Box>
        ))}
      </Box>
    </Card>
  );
};

export default DifficultySelect;
