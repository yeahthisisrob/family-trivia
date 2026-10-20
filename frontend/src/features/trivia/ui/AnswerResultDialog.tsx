// File: src/features/trivia/ui/AnswerResultDialog.tsx
import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import StarsIcon from '@mui/icons-material/Stars';
import { alpha, Box, Button, Chip, Dialog, Divider, Paper, Typography } from '@mui/material';
import type React from 'react';

import type { Question } from '../../../api/modules/trivia';
import appStrings from '../../../constants/strings';
import { colors } from '../../../shared/design-system';
import { getUserColor, getUserInitials } from '../../../utils';
import { CommentsThread } from '../../comments';

interface AnswerResultDialogProps {
  open: boolean;
  onClose: () => void;
  onNext?: () => void;
  question?: Question;
  selected?: string | null;
  isCorrect: boolean;
  pointsEarned?: number;
  isCatchingUp?: boolean;
  /** UserId of the player who answered */
  userId?: string;
  /** Timestamp of when the answer was submitted (used to build triviaId for comments) */
  answerTimestamp?: string;
}

const AnswerResultDialog: React.FC<AnswerResultDialogProps> = ({
  open,
  onClose,
  onNext,
  question,
  selected,
  isCorrect,
  pointsEarned = 0,
  isCatchingUp = false,
  userId,
  answerTimestamp,
}) => {
  const triviaId = userId && answerTimestamp ? `${userId}_${answerTimestamp}` : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            maxHeight: { xs: '95vh', sm: '80vh' },
            display: 'flex',
            flexDirection: 'column',
            margin: { xs: '10px', sm: 'auto' },
            width: { xs: 'calc(100% - 20px)', sm: '600px' },
          },
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: { xs: 1.5, sm: 2.5 },
          textAlign: 'center',
          backgroundColor: isCorrect ? colors.result.correct : colors.result.incorrect,
          color: colors.onColor,
        }}
      >
        {isCorrect ? (
          <CheckCircleIcon sx={{ mb: 0.5, fontSize: { xs: '1.75rem', sm: '2.25rem' } }} />
        ) : (
          <CancelIcon sx={{ mb: 0.5, fontSize: { xs: '1.75rem', sm: '2.25rem' } }} />
        )}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 'bold',
            fontSize: { xs: '1.1rem', sm: '1.4rem' },
          }}
        >
          {isCorrect ? appStrings.resultDialog.correct : appStrings.resultDialog.incorrect}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ p: { xs: 1.5, sm: 2.5 }, overflowY: 'auto', flex: 1 }}>
        {question?.question && (
          <>
            <Typography
              sx={{
                mb: { xs: 1.5, sm: 2 },
                fontSize: { xs: '0.9rem', sm: '1rem' },
                fontWeight: 500,
              }}
            >
              {question.question}
            </Typography>

            {/* Answer choices */}
            {question.choices?.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  mb: 2,
                }}
              >
                {question.choices.map((choice) => {
                  const isUserChoice = choice === selected;
                  const isCorrectChoice = choice === question.answer;

                  let bgColor: string = 'action.hover';
                  let borderColor: string = 'divider';

                  if (isUserChoice && !isCorrect) {
                    bgColor = alpha(colors.result.incorrect, 0.1);
                    borderColor = colors.result.incorrect;
                  } else if (isCorrectChoice) {
                    bgColor = alpha(colors.result.correct, 0.1);
                    borderColor = colors.result.correct;
                  }

                  return (
                    <Paper
                      key={choice}
                      elevation={isUserChoice || isCorrectChoice ? 1 : 0}
                      sx={{
                        p: { xs: 1.25, sm: 1.5 },
                        border: '2px solid',
                        borderColor,
                        borderRadius: 2,
                        backgroundColor: bgColor,
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: isUserChoice || isCorrectChoice ? 2 : 0,
                      }}
                    >
                      <Typography
                        sx={{ mr: 2, flex: 1, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}
                      >
                        {choice}
                      </Typography>

                      {isCorrectChoice && (
                        <CheckCircleIcon
                          color="success"
                          sx={{ flexShrink: 0, fontSize: '1.25rem' }}
                        />
                      )}
                      {isUserChoice && !isCorrect && (
                        <CancelIcon color="error" sx={{ flexShrink: 0, fontSize: '1.25rem' }} />
                      )}

                      {isUserChoice && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -12,
                            left: 10,
                            backgroundColor: isCorrect
                              ? colors.result.correct
                              : colors.result.incorrect,
                            color: colors.onColor,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            boxShadow: `0px 1px 3px ${alpha(colors.scrim, 0.2)}`,
                          }}
                        >
                          YOUR PICK
                        </Box>
                      )}

                      {isCorrectChoice && !isUserChoice && !isCorrect && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: -12,
                            left: 10,
                            backgroundColor: colors.result.correct,
                            color: colors.onColor,
                            px: 1,
                            py: 0.25,
                            borderRadius: 1,
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            boxShadow: `0px 1px 3px ${alpha(colors.scrim, 0.2)}`,
                          }}
                        >
                          CORRECT ANSWER
                        </Box>
                      )}
                    </Paper>
                  );
                })}
              </Box>
            )}
          </>
        )}

        {/* Achievement chips */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 2 }}>
          {pointsEarned > 0 && isCorrect && (
            <Chip
              icon={<StarsIcon sx={{ fontSize: '1rem !important' }} />}
              label={appStrings.resultDialog.points(pointsEarned)}
              color="primary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>

        {/* Inline comments — say something about this question */}
        {triviaId && userId && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Typography
              sx={{ fontSize: '0.72rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}
            >
              Say something about this one
            </Typography>
            <CommentsThread
              contentId={triviaId}
              contentType="trivia"
              currentUserId={userId}
              getUserColor={getUserColor}
              getUserInitials={getUserInitials}
              textOverrides={{ placeholderText: 'That was a tough one...' }}
            />
          </>
        )}
      </Box>

      {/* Sticky buttons */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          justifyContent: 'center',
          flexDirection: { xs: 'column', sm: 'row' },
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Button
          variant="outlined"
          onClick={onClose}
          fullWidth
          sx={{ py: { xs: 1.25, sm: 0.75 }, fontSize: '0.85rem' }}
        >
          Close
        </Button>
        {onNext && (
          <Button
            variant="contained"
            color={isCorrect ? 'success' : 'primary'}
            onClick={onNext}
            fullWidth
            sx={{ py: { xs: 1.25, sm: 0.75 }, fontSize: '0.85rem' }}
          >
            {isCatchingUp ? appStrings.resultDialog.nextQuestion : appStrings.resultDialog.done}
          </Button>
        )}
      </Box>
    </Dialog>
  );
};

export default AnswerResultDialog;
