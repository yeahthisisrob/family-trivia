// Reusable card wrapper for admin panel sections.
// Uses design system tokens for consistent look across all admin tabs.

import { Box, Typography, useTheme, alpha } from '@mui/material';
import React from 'react';

import { radii } from '../../../shared/design-system/tokens/radii';
import { shadows } from '../../../shared/design-system/tokens/shadows';

interface AdminCardProps {
  title?: string;
  subtitle?: string;
  /** Chip or icon to show next to title */
  badge?: React.ReactNode;
  /** Action buttons in the top-right */
  actions?: React.ReactNode;
  /** Highlight the card (e.g., active season) */
  highlighted?: boolean;
  children: React.ReactNode;
}

const AdminCard: React.FC<AdminCardProps> = ({
  title, subtitle, badge, actions, highlighted, children,
}) => {
  const theme = useTheme();

  return (
    <Box sx={{
      bgcolor: theme.palette.background.paper,
      borderRadius: `${radii.lg}px`,
      boxShadow: highlighted ? shadows.md : shadows.card,
      border: `1px solid ${alpha(theme.palette.divider, highlighted ? 0.2 : 0.08)}`,
      overflow: 'hidden',
      ...(highlighted && {
        borderLeft: `3px solid ${theme.palette.primary.main}`,
      }),
    }}>
      {(title || actions) && (
        <Box sx={{
          px: 2, py: 1.25,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {title && (
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {title}
              </Typography>
            )}
            {badge}
            {subtitle && (
              <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
              {actions}
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ p: 2 }}>
        {children}
      </Box>
    </Box>
  );
};

export default AdminCard;
