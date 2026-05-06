// File: components/FamilyTree/MemberLoadingError.tsx
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Typography, Button } from '@mui/material';
import React from 'react';

interface MemberLoadingErrorProps {
  message: string;
  onRetry: () => void;
}

/**
 * Displays an error message when member data fails to load
 * with a retry button to attempt loading again
 */
const MemberLoadingError: React.FC<MemberLoadingErrorProps> = ({ message, onRetry }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        height: '100%',
        p: 3,
        gap: 2,
      }}
    >
      <ErrorOutlineIcon color="error" sx={{ fontSize: 48 }} />

      <Typography variant="h6" color="error" gutterBottom>
        Unable to Load Members
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 2 }}>
        {message}
      </Typography>

      <Button
        variant="contained"
        color="primary"
        startIcon={<RefreshIcon />}
        onClick={onRetry}
        size="large"
      >
        Retry Loading
      </Button>
    </Box>
  );
};

export default MemberLoadingError;
