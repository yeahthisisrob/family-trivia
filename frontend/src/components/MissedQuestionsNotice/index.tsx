// components/MissedQuestionsNotice/index.tsx
import {
  QuestionAnswer as QuestionAnswerIcon,
  Close as CloseIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { Box, Paper, Typography, Button, useTheme, alpha, Fade, IconButton } from '@mui/material';
import React, { useState, useEffect } from 'react';

import { getUserFactHistory } from '../../api/modules/facts';
import { createLogger } from '../../utils/logger';

interface MissedQuestionsNoticeProps {
  userId: string;
  onViewQuestions: () => void;
}

const logger = createLogger('MissedQuestionsNotice');

const MissedQuestionsNotice: React.FC<MissedQuestionsNoticeProps> = ({
  userId,
  onViewQuestions,
}) => {
  const theme = useTheme();
  const [missedCount, setMissedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkMissedQuestions = async () => {
      try {
        const history = await getUserFactHistory(userId, true);

        // Count unanswered questions (not skipped, just never responded)
        let unanswered = 0;

        // Check basic questions
        history.basicQuestions.forEach((_, index) => {
          const hasAnswer = history.history.some(
            (item) => item.questionType === 'basic' && item.questionIndex === index,
          );
          if (!hasAnswer) unanswered++;
        });

        // Check shared questions
        history.allSharedQuestions.forEach((sharedQ) => {
          const hasAnswer = history.history.some(
            (item) => item.questionType === 'shared' && item.date === sharedQ.date,
          );
          if (!hasAnswer && !sharedQ.skipped) unanswered++;
        });

        setMissedCount(unanswered);
      } catch (error) {
        logger.error('Failed to check missed questions:', error);
      } finally {
        setLoading(false);
      }
    };

    // Defer this expensive call so it doesn't block initial render
    const timer = setTimeout(() => {
      checkMissedQuestions();
    }, 3000);

    return () => clearTimeout(timer);
  }, [userId]);

  // Don't show if loading, dismissed, or no missed questions
  if (loading || dismissed || missedCount === 0) {
    return null;
  }

  return (
    <Fade in={true} timeout={500}>
      <Paper
        elevation={3}
        sx={{
          mb: 2,
          p: 2.5,
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.light, 0.15)} 0%, ${alpha(theme.palette.warning.main, 0.1)} 100%)`,
          border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
          borderRadius: 2,
          position: 'relative',
          overflow: 'hidden',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${theme.palette.warning.light} 0%, ${theme.palette.warning.main} 100%)`,
          },
        }}
      >
        <IconButton
          size="small"
          onClick={() => setDismissed(true)}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            color: theme.palette.text.secondary,
            '&:hover': {
              bgcolor: alpha(theme.palette.action.hover, 0.5),
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.warning.main, 0.1),
              flexShrink: 0,
            }}
          >
            <QuestionAnswerIcon
              sx={{
                fontSize: 28,
                color: theme.palette.warning.dark,
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
              }}
            />
          </Box>

          <Box sx={{ flex: 1, pr: 4 }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 700,
                color: theme.palette.warning.dark,
                mb: 0.5,
              }}
            >
              You have {missedCount} unanswered personal question{missedCount !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Take a moment to share your thoughts and complete your personal journey.
            </Typography>
          </Box>

          <Button
            variant="contained"
            onClick={onViewQuestions}
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: theme.palette.warning.main,
              color: theme.palette.warning.contrastText,
              fontWeight: 600,
              px: 2.5,
              py: 1,
              borderRadius: 2,
              boxShadow: 2,
              '&:hover': {
                bgcolor: theme.palette.warning.dark,
                boxShadow: 4,
              },
              transition: 'all 0.3s ease',
            }}
          >
            View Questions
          </Button>
        </Box>
      </Paper>
    </Fade>
  );
};

export default MissedQuestionsNotice;
