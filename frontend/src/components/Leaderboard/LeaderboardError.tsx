// File: src/components/Leaderboard/LeaderboardError.tsx
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Typography, Button, Paper } from '@mui/material';
import React from 'react';

interface LeaderboardErrorProps {
  message: string;
  onRetry: () => void;
}

/**
 * Displays an error message when leaderboard data fails to load
 * with a retry button to attempt loading again
 */
const LeaderboardError: React.FC<LeaderboardErrorProps> = ({ message, onRetry }) => {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 3,
        borderRadius: 2,
        width: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          py: 4,
          gap: 2,
        }}
      >
        <ErrorOutlineIcon color="error" sx={{ fontSize: 40 }} />

        <Typography variant="h6" color="error" gutterBottom>
          Unable to Load Leaderboard
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: 2 }}>
          {message}
        </Typography>

        <Button
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          size="medium"
        >
          Retry Loading
        </Button>
      </Box>
    </Paper>
  );
};

export default LeaderboardError;
