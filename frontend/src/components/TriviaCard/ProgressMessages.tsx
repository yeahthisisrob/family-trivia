// Progress messages display component
import { Box, Fade, LinearProgress, Paper, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

import { ProgressMessage } from '../../api/modules/trivia';

interface ProgressMessagesProps {
  messages: ProgressMessage[];
  isGenerating: boolean;
}

const ProgressMessages: React.FC<ProgressMessagesProps> = ({ messages, isGenerating }) => {
  const [visibleMessages, setVisibleMessages] = useState<ProgressMessage[]>([]);

  // Compute progress as derived state
  const progress = messages.length > 0 ? (visibleMessages.length / messages.length) * 100 : 0;

  useEffect(() => {
    if (messages.length > 0) {
      // Show messages one by one with a delay
      const timer = setTimeout(() => {
        setVisibleMessages(messages.slice(0, visibleMessages.length + 1));
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [messages, visibleMessages.length]);

  if (!isGenerating && messages.length === 0) {
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

  const getMessageColor = (type: ProgressMessage['type']) => {
    switch (type) {
      case 'info':
        return 'primary.main';
      case 'checking':
        return 'info.main';
      case 'warning':
        return 'warning.main';
      case 'success':
        return 'success.main';
      default:
        return 'text.primary';
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        p: 3,
        mb: 2,
        backgroundColor: 'background.paper',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ mb: 2 }}>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'action.hover',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              background: 'linear-gradient(90deg, #1976d2 0%, #42a5f5 100%)',
            },
          }}
        />
      </Box>

      <Box sx={{ minHeight: 120 }}>
        {visibleMessages.map((msg, index) => (
          <Fade in={true} timeout={500} key={index}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                mb: 1.5,
                opacity: index === visibleMessages.length - 1 ? 1 : 0.7,
                transition: 'opacity 0.3s',
              }}
            >
              <Box sx={{ mr: 1.5, fontSize: '1.2rem' }}>{getMessageIcon(msg.type)}</Box>
              <Box flex={1}>
                <Typography
                  variant="body1"
                  sx={{
                    color: getMessageColor(msg.type),
                    fontWeight: index === visibleMessages.length - 1 ? 500 : 400,
                  }}
                >
                  {msg.message}
                </Typography>
                {msg.detail && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      display: 'block',
                      mt: 0.5,
                    }}
                  >
                    {msg.detail}
                  </Typography>
                )}
              </Box>
            </Box>
          </Fade>
        ))}
      </Box>

      {isGenerating && visibleMessages.length === messages.length && (
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              '& > div': {
                width: 8,
                height: 8,
                backgroundColor: 'primary.main',
                borderRadius: '50%',
                animation: 'bounce 1.4s infinite ease-in-out both',
              },
              '& > div:nth-of-type(1)': {
                animationDelay: '-0.32s',
              },
              '& > div:nth-of-type(2)': {
                animationDelay: '-0.16s',
              },
              '@keyframes bounce': {
                '0%, 80%, 100%': {
                  transform: 'scale(0)',
                },
                '40%': {
                  transform: 'scale(1)',
                },
              },
            }}
          >
            <div />
            <div />
            <div />
          </Box>
        </Box>
      )}
    </Paper>
  );
};

export default ProgressMessages;
