/** Admin › Daily Qs: the shared daily questions, newest first, mobile-first cards. */
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import { Alert, alpha, Box, Chip, IconButton, Typography, useTheme } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { AdminCard, ConfirmDialog, EmptyState } from '../../../shared/admin-ui';
import { createLogger } from '../../../shared/lib/logger';
import { useAdminQuestions, useDeleteQuestion } from '../model/questions';

const logger = createLogger('DailyQuestionsTab');

export const DailyQuestionsTab: React.FC = () => {
  const theme = useTheme();
  const read = useAdminQuestions();
  const deleting = useDeleteQuestion();
  const questions = read.data ?? [];
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Error | null>(null);
  const failure = read.isError && !read.data ? read.error : deleting.error;
  const error =
    failure && failure !== dismissed
      ? failure === deleting.error
        ? 'Failed to delete daily question'
        : 'Failed to load daily questions'
      : null;

  const handleDelete = () => {
    if (!confirmDelete) return;
    deleting.mutate(confirmDelete, {
      onSuccess: () => setConfirmDelete(null),
      onError: (err) => logger.error('Failed to delete', err),
    });
  };

  const formatDate = (d: string) => {
    try {
      return new Date(`${d}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return d;
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setDismissed(failure)}>
          {error}
        </Alert>
      )}

      {read.isPending ? (
        <LoadingDots mt={2} />
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<QuestionAnswerIcon sx={{ fontSize: 'inherit' }} />}
          message="No daily questions yet"
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {questions.map((q) => (
            <AdminCard
              key={q.date}
              badge={
                <Chip
                  icon={<CalendarTodayIcon sx={{ fontSize: '12px !important' }} />}
                  label={formatDate(q.date)}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.65rem',
                    fontWeight: 600,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: theme.palette.primary.main,
                  }}
                />
              }
              actions={
                <IconButton size="small" color="error" onClick={() => setConfirmDelete(q.date)}>
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              }
            >
              <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5 }}>
                {q.question || '-'}
              </Typography>
              {q.createdBy && (
                <Typography
                  sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled, mt: 0.5 }}
                >
                  Created by {q.createdBy}
                </Typography>
              )}
            </AdminCard>
          ))}
        </Box>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Daily Question"
        message={`This will delete the shared question for ${confirmDelete} and remove all user answers for that date.`}
        confirmLabel="Delete Question"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  );
};
