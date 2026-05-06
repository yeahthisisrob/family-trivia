import { Box, Fade, LinearProgress, Typography, alpha } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { ProgressMessage } from '../../api/modules/trivia';

interface CasinoRushProgressProps {
  messages: ProgressMessage[];
  compact?: boolean;
}

const CasinoRushProgress: React.FC<CasinoRushProgressProps> = ({ messages, compact = true }) => {
  const [visibleMessages, setVisibleMessages] = useState<ProgressMessage[]>([]);

  useEffect(() => {
    if (messages.length > visibleMessages.length) {
      // Show messages quickly for fast-paced game
      const timer = setTimeout(() => {
        setVisibleMessages(messages.slice(0, visibleMessages.length + 1));
      }, 200); // Faster than dialog version

      return () => clearTimeout(timer);
    }
  }, [messages, visibleMessages.length]);

  if (messages.length === 0) {
    return null;
  }

  const getMessageIcon = (type: ProgressMessage['type']) => {
    switch (type) {
      case 'info':
        return '🎯';
      case 'checking':
        return '🔍';
      case 'warning':
        return '⚠️';
      case 'success':
        return '✅';
      default:
        return '📝';
    }
  };

  const progress = messages.length > 0 ? (visibleMessages.length / messages.length) * 100 : 0;

  return (
    <Box
      sx={{
        p: compact ? 1.5 : 2,
        mb: 2,
        borderRadius: 2,
        bgcolor: (theme) => alpha(theme.palette.warning.main, 0.1),
        border: (theme) => `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
      }}
    >
      {/* Compact progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{
          height: 4,
          mb: 1,
          borderRadius: 2,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': {
            borderRadius: 2,
            background: 'linear-gradient(90deg, #ff6b6b 0%, #ffa502 100%)',
          },
        }}
      />

      {/* Messages */}
      <Box sx={{ minHeight: compact ? 30 : 60 }}>
        {visibleMessages.map((msg, index) => (
          <Fade in={true} timeout={300} key={index}>
            <Box
              sx={{
                display: index === visibleMessages.length - 1 ? 'flex' : 'none',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Box sx={{ fontSize: compact ? '1rem' : '1.2rem' }}>{getMessageIcon(msg.type)}</Box>
              <Typography
                variant={compact ? 'body2' : 'body1'}
                sx={{
                  fontWeight: 500,
                  color: 'text.primary',
                }}
              >
                {msg.message}
              </Typography>
            </Box>
          </Fade>
        ))}
      </Box>
    </Box>
  );
};

export default CasinoRushProgress;
