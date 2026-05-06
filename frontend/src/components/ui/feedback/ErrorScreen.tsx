import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, Paper, Typography, Button, Fade, useTheme } from '@mui/material';
import React from 'react';

/**
 * ErrorScreen Component
 *
 * A reusable component for displaying error states to the user with a
 * friendly message and retry button.
 */
export interface ErrorScreenProps {
  /**
   * Error message to display to the user
   */
  message: string;

  /**
   * Callback function when the retry button is clicked
   */
  onRetry: () => void;

  /**
   * Controls whether the component is visible
   * @default true
   */
  open?: boolean;

  /**
   * Custom title for the error screen
   * @default "Connection Error"
   */
  title?: string;

  /**
   * Button text to display
   * @default "Try Again"
   */
  buttonText?: string;
}

/**
 * A full-screen error display component with a retry button
 */
export const ErrorScreen: React.FC<ErrorScreenProps> = ({
  message,
  onRetry,
  open = true,
  title = 'Connection Error',
  buttonText = 'Try Again',
}) => {
  const theme = useTheme();

  return (
    <Fade in={open}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bgcolor: theme.palette.grey[50],
          p: 3,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            maxWidth: 500,
            borderRadius: 3,
          }}
        >
          <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', fontWeight: 'bold' }}>
            {title}
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
            {message}
          </Typography>

          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={onRetry}
            size="large"
            sx={{ borderRadius: 2, px: 4 }}
          >
            {buttonText}
          </Button>
        </Paper>
      </Box>
    </Fade>
  );
};
