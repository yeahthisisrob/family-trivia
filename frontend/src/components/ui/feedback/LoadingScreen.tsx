import { keyframes } from '@emotion/react';
import { Box, Typography, Fade, useTheme } from '@mui/material';
import React from 'react';

const wave = keyframes`
  0%, 60%, 100% {
    transform: translateY(0) scale(1);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-10px) scale(1.15);
    opacity: 1;
  }
`;

const fadeUp = keyframes`
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

export interface LoadingScreenProps {
  message?: string;
  open?: boolean;
  /** @deprecated unused */
  spinnerSize?: number;
  /** @deprecated unused */
  spinnerThickness?: number;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading...',
  open = true,
}) => {
  const theme = useTheme();
  const color = theme.palette.primary.main;

  return (
    <Fade in={open} timeout={400}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: `linear-gradient(160deg, ${theme.palette.grey[50]} 0%, #e8f4fd 100%)`,
          gap: 3,
        }}
      >
        {/* Animated dots */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: color,
                animation: `${wave} 1.4s ease-in-out infinite`,
                animationDelay: `${i * 0.18}s`,
              }}
            />
          ))}
        </Box>

        {message && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontWeight: 500,
              letterSpacing: '0.02em',
              animation: `${fadeUp} 0.6s ease-out both`,
              animationDelay: '0.2s',
            }}
          >
            {message}
          </Typography>
        )}
      </Box>
    </Fade>
  );
};
