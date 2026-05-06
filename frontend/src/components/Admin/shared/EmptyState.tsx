// Shared empty state for when lists have no data.

import { Box, Typography, useTheme, alpha } from '@mui/material';
import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, message, action }) => {
  const theme = useTheme();

  return (
    <Box sx={{
      py: 4, px: 2,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
      color: theme.palette.text.secondary,
    }}>
      {icon && (
        <Box sx={{ fontSize: 32, opacity: 0.4, color: alpha(theme.palette.text.secondary, 0.4) }}>
          {icon}
        </Box>
      )}
      <Typography sx={{ fontSize: '0.8rem', textAlign: 'center' }}>
        {message}
      </Typography>
      {action}
    </Box>
  );
};

export default EmptyState;
