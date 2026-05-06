// File: frontend/src/components/Admin/DailyQuestionsTab.tsx
// Daily shared fact questions — card list layout, mobile-first.

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import DeleteIcon from '@mui/icons-material/Delete';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import {
  Alert,
  Box,
  Chip,
  IconButton,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import AdminCard from './shared/AdminCard';
import ConfirmDialog from './shared/ConfirmDialog';
import EmptyState from './shared/EmptyState';
import { getDailyQuestions, deleteDailyQuestion, DailyQuestionEntry } from '../../api/modules/admin';
import { useAdmin } from '../../contexts/AdminContext';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('DailyQuestionsTab');

const DailyQuestionsTab: React.FC = () => {
  const { adminUserId } = useAdmin();
  const theme = useTheme();
  const [questions, setQuestions] = useState<DailyQuestionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = await getDailyQuestions(adminUserId);
      setQuestions(qs.sort((a, b) => b.date.localeCompare(a.date)));
    } catch (err) {
      logger.error('Failed to load daily questions', err);
      setError('Failed to load daily questions');
    } finally {
      setLoading(false);
    }
  }, [adminUserId]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteDailyQuestion(adminUserId, confirmDelete);
      setConfirmDelete(null);
      await loadQuestions();
    } catch (err) {
      logger.error('Failed to delete', err);
      setError('Failed to delete daily question');
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
    } catch { return d; }
  };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? <LoadingDots mt={2} /> : questions.length === 0 ? (
        <EmptyState
          icon={<QuestionAnswerIcon sx={{ fontSize: 'inherit' }} />}
          message="No daily questions yet"
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {questions.map(q => (
            <AdminCard
              key={q.date}
              badge={
                <Chip
                  icon={<CalendarTodayIcon sx={{ fontSize: '12px !important' }} />}
                  label={formatDate(q.date)}
                  size="small"
                  sx={{
                    height: 22, fontSize: '0.65rem', fontWeight: 600,
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
                <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled, mt: 0.5 }}>
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
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  );
};

export default DailyQuestionsTab;
