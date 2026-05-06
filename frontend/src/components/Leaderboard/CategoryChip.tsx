// File: frontend/src/components/Leaderboard/CategoryChip.tsx
import { Chip, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';

import { getCategoryColor, isCustomCategory } from '../../utils/categoryUtils';

interface CategoryChipProps {
  category: string;
  score?: number;
  size?: 'small' | 'medium';
}

/**
 * CategoryChip component for displaying category information consistently.
 *
 * Special handling for custom categories:
 * - All custom categories are displayed as "Custom" regardless of their specific name
 * - All custom categories are aggregated together for scoring displays
 */
const CategoryChip: React.FC<CategoryChipProps> = ({ category, score, size: propSize }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const size = propSize || (isMobile ? 'small' : 'medium');

  // Check if this is a custom category
  const isCustomCat = category === 'Custom' || isCustomCategory(category);

  // For custom categories, always display as "Custom"
  // For regular categories, show just the first word for brevity
  // Special handling for "Wee Wonders" category - display as "Custom"
  const displayName =
    isCustomCat || category.includes('Wonders') ? 'Custom' : category.split(' ')[0];

  // Create the label based on whether we're showing a score
  const label = score !== undefined ? `${displayName}: ${score}` : displayName;

  // Get the color (for custom categories, use a fixed color)
  // Always use CUSTOM_CATEGORY_COLOR from categoryUtils.ts for consistency
  const chipColor = isCustomCat ? '#9C27B0' : getCategoryColor(category);

  return (
    <Chip
      label={label}
      size={size}
      sx={{
        bgcolor: chipColor,
        color: 'white',
        fontWeight: 'bold',
        height: size === 'small' ? 24 : 32,
        fontSize: size === 'small' ? '0.75rem' : '0.9rem',
      }}
    />
  );
};

export default CategoryChip;
