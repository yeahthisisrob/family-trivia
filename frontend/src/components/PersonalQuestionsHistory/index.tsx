// components/PersonalQuestionsHistory/index.tsx
import {
  ExpandMore as ExpandMoreIcon,
  QuestionAnswer as QuestionAnswerIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
  Schedule as ScheduleIcon,
  CalendarToday as CalendarTodayIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  TextField,
  Button,
  Tabs,
  Tab,
  Paper,
  Fade,
  Tooltip,
  useTheme,
  alpha,
  Skeleton,
} from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';

import {
  getUserFactHistory,
  submitHistoricalFact,
  FactHistoryItem,
  UserFactHistory,
} from '../../api/modules/facts';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

interface PersonalQuestionsHistoryProps {
  userId: string;
  onClose?: () => void;
}

interface EditingState {
  questionId: string;
  answer: string;
}

const logger = createLogger('PersonalQuestionsHistory');

const PersonalQuestionsHistory: React.FC<PersonalQuestionsHistoryProps> = ({ userId }) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [history, setHistory] = useState<UserFactHistory | null>(null);
  const [editingStates, setEditingStates] = useState<Record<string, EditingState>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState(0); // 0: All, 1: Unanswered, 2: Basic, 3: Shared

  // Load user's fact history
  useEffect(() => {
    const loadHistory = async () => {
      setLoading(true);
      try {
        const data = await getUserFactHistory(userId, true);
        setHistory(data);
      } catch (error) {
        logger.error('Failed to load fact history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [userId]);

  // Create unique ID for each question
  const getQuestionId = (item: FactHistoryItem): string => {
    if (item.questionType === 'basic' && item.questionIndex !== undefined) {
      return `basic_${item.questionIndex}_${item.date || ''}`;
    }
    return `shared_${item.date || ''}`;
  };

  // Get all questions organized by status
  const getOrganizedQuestions = useCallback(() => {
    if (!history) return { all: [], unanswered: [], basic: [], shared: [] };

    const userAnsweredQuestions = new Map<string, FactHistoryItem>();

    // First, map all user's answered questions
    (history.history || []).forEach((item) => {
      const id = getQuestionId(item);
      userAnsweredQuestions.set(id, item);
    });

    const all: FactHistoryItem[] = [];
    const unanswered: FactHistoryItem[] = [];
    const basic: FactHistoryItem[] = [];
    const shared: FactHistoryItem[] = [];

    // Process basic questions
    (history.basicQuestions || []).forEach((question, index) => {
      const basicId = `basic_${index}_`;
      const userAnswer = Array.from(userAnsweredQuestions.entries()).find(([key]) =>
        key.startsWith(basicId),
      );

      const item: FactHistoryItem = userAnswer
        ? userAnswer[1]
        : {
            question,
            questionType: 'basic',
            questionIndex: index,
            answered: false,
            timestamp: '',
          };

      all.push(item);
      if (item.questionType === 'basic') basic.push(item);
      if (!item.answered) unanswered.push(item);
    });

    // Process shared questions
    (history.allSharedQuestions || []).forEach((sharedQ) => {
      let userAnswer: FactHistoryItem | undefined;

      // Find if user answered this shared question
      (history.history || []).forEach((item) => {
        if (item.questionType === 'shared' && item.date === sharedQ.date) {
          userAnswer = item;
        }
      });

      const item: FactHistoryItem = userAnswer || {
        ...sharedQ,
        answered: false,
        timestamp: sharedQ.timestamp || '',
      };

      all.push(item);
      if (item.questionType === 'shared') shared.push(item);
      if (!item.answered && !item.skipped) unanswered.push(item);
    });

    // Sort by date (most recent first)
    const sortByDate = (a: FactHistoryItem, b: FactHistoryItem) => {
      const dateA = a.date || a.timestamp || '';
      const dateB = b.date || b.timestamp || '';
      return dateB.localeCompare(dateA);
    };

    all.sort(sortByDate);
    unanswered.sort(sortByDate);
    shared.sort(sortByDate);

    return { all, unanswered, basic, shared };
  }, [history]);

  const { all, unanswered, basic, shared } = getOrganizedQuestions();

  // Get questions for current tab
  const getQuestionsForTab = () => {
    switch (activeTab) {
      case 0:
        return all;
      case 1:
        return unanswered;
      case 2:
        return basic;
      case 3:
        return shared;
      default:
        return all;
    }
  };

  // Handle editing
  const startEditing = (item: FactHistoryItem) => {
    const id = getQuestionId(item);
    setEditingStates({
      ...editingStates,
      [id]: {
        questionId: id,
        answer: item.answer || '',
      },
    });
  };

  const cancelEditing = (item: FactHistoryItem) => {
    const id = getQuestionId(item);
    const newStates = { ...editingStates };
    delete newStates[id];
    setEditingStates(newStates);
  };

  const updateEditingAnswer = (item: FactHistoryItem, answer: string) => {
    const id = getQuestionId(item);
    setEditingStates({
      ...editingStates,
      [id]: {
        ...editingStates[id],
        answer,
      },
    });
  };

  // Handle submission
  const handleSubmit = async (item: FactHistoryItem) => {
    const id = getQuestionId(item);
    const editingState = editingStates[id];

    if (!editingState || !editingState.answer.trim()) return;

    setSubmitting(id);
    try {
      await submitHistoricalFact({
        userId,
        question: item.question,
        answer: editingState.answer.trim(),
        date: item.date || new Date().toISOString().split('T')[0],
        questionType: item.questionType,
        questionIndex: item.questionIndex,
      });

      // Update local state by refetching
      const data = await getUserFactHistory(userId, true);
      setHistory(data);

      // Clear editing state
      cancelEditing(item);

      // Expand to show the new fact
      setExpandedItems(new Set(Array.from(expandedItems).concat(id)));
    } catch (error) {
      logger.error('Failed to submit answer:', error);
    } finally {
      setSubmitting(null);
    }
  };

  // Handle accordion expansion
  const handleAccordionChange =
    (item: FactHistoryItem) => (_: React.SyntheticEvent, isExpanded: boolean) => {
      const id = getQuestionId(item);
      const newExpanded = new Set(expandedItems);

      if (isExpanded) {
        newExpanded.add(id);
      } else {
        newExpanded.delete(id);
      }

      setExpandedItems(newExpanded);
    };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Skeleton variant="rectangular" height={60} sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={80} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }

  const questions = getQuestionsForTab();

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 3,
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.primary.main, 0.1)} 100%)`,
          borderRadius: 3,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <QuestionAnswerIcon sx={{ fontSize: 32, color: theme.palette.primary.main, mr: 2 }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, color: theme.palette.primary.main }}>
              Personal Questions Journey
            </Typography>
            <Typography variant="body2" color="text.secondary">
              View and answer all your past personal questions
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip
            icon={<CheckCircleIcon />}
            label={`${all.filter((q) => q.answered).length} Answered`}
            color="success"
            variant="outlined"
          />
          <Chip
            icon={<RadioButtonUncheckedIcon />}
            label={`${unanswered.length} Unanswered`}
            color="warning"
            variant="outlined"
          />
          <Chip
            icon={<CalendarTodayIcon />}
            label={`${shared.length} Daily Questions`}
            color="primary"
            variant="outlined"
          />
        </Box>
      </Paper>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{
          mb: 3,
          '& .MuiTabs-indicator': {
            height: 3,
            borderRadius: 1.5,
          },
        }}
      >
        <Tab label={`All (${all.length})`} />
        <Tab
          label={`Unanswered (${unanswered.length})`}
          sx={{
            color: unanswered.length > 0 ? theme.palette.warning.main : undefined,
            '&.Mui-selected': {
              color: unanswered.length > 0 ? theme.palette.warning.dark : undefined,
            },
          }}
        />
        <Tab label={`Basic (${basic.length})`} />
        <Tab label={`Shared (${shared.length})`} />
      </Tabs>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {questions.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
            <Typography variant="body1" color="text.secondary">
              No questions found in this category
            </Typography>
          </Paper>
        ) : (
          questions.map((item, index) => {
            const id = getQuestionId(item);
            const isEditing = !!editingStates[id];
            const isExpanded = expandedItems.has(id);
            const isSubmitting = submitting === id;

            return (
              <Fade in key={id} timeout={300 + index * 50}>
                <Accordion
                  expanded={isExpanded}
                  onChange={handleAccordionChange(item)}
                  sx={{
                    mb: 1,
                    borderRadius: 2,
                    '&:before': { display: 'none' },
                    boxShadow: isExpanded ? 2 : 1,
                    transition: 'all 0.3s ease',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    ...(item.answered && {
                      bgcolor: alpha(theme.palette.success.main, 0.02),
                    }),
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      '& .MuiAccordionSummary-content': {
                        alignItems: 'center',
                        gap: 2,
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      {item.answered ? (
                        <Tooltip title="Answered">
                          <CheckCircleIcon
                            sx={{ color: theme.palette.success.main, fontSize: 20 }}
                          />
                        </Tooltip>
                      ) : (
                        <Tooltip title="Not answered">
                          <RadioButtonUncheckedIcon
                            sx={{ color: theme.palette.warning.main, fontSize: 20 }}
                          />
                        </Tooltip>
                      )}

                      <Typography
                        variant="body1"
                        sx={{ flex: 1, fontWeight: item.answered ? 400 : 500 }}
                      >
                        {item.question}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        {item.questionType === 'basic' ? (
                          <Chip
                            label={`Basic ${item.questionIndex !== undefined ? item.questionIndex + 1 : ''}`}
                            size="small"
                            sx={{ bgcolor: alpha(theme.palette.grey[500], 0.1) }}
                          />
                        ) : (
                          <Chip label="Shared" size="small" color="primary" variant="outlined" />
                        )}

                        {item.date && (
                          <Chip
                            icon={<ScheduleIcon sx={{ fontSize: 16 }} />}
                            label={new Date(item.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Box>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ pt: 0 }}>
                    {isEditing ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                          fullWidth
                          multiline
                          rows={3}
                          value={editingStates[id]?.answer || ''}
                          onChange={(e) => updateEditingAnswer(item, e.target.value)}
                          label="Your Answer"
                          variant="outlined"
                          disabled={isSubmitting}
                          autoFocus
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              bgcolor: 'background.paper',
                            },
                          }}
                        />
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                          <Button
                            onClick={() => cancelEditing(item)}
                            disabled={isSubmitting}
                            startIcon={<CancelIcon />}
                            size="small"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="contained"
                            onClick={() => handleSubmit(item)}
                            disabled={!editingStates[id]?.answer.trim() || isSubmitting}
                            startIcon={isSubmitting ? <LoadingDots size={4} inline /> : <SaveIcon />}
                            size="small"
                          >
                            {isSubmitting ? 'Saving...' : 'Save Answer'}
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Box>
                        {item.answered && item.answer && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                              Your Answer:
                            </Typography>
                            <Paper
                              elevation={0}
                              sx={{
                                p: 2,
                                bgcolor: alpha(theme.palette.grey[100], 0.5),
                                borderLeft: `4px solid ${theme.palette.primary.main}`,
                              }}
                            >
                              <Typography variant="body2">
                                {item.answer === '[Skipped]' ? (
                                  <em style={{ color: theme.palette.text.secondary }}>
                                    You skipped this question
                                  </em>
                                ) : (
                                  item.answer
                                )}
                              </Typography>
                            </Paper>
                          </Box>
                        )}

                        {item.answered && item.fact && (
                          <Box sx={{ mb: 2 }}>
                            <Typography
                              variant="subtitle2"
                              color="text.secondary"
                              gutterBottom
                              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                            >
                              <LightbulbIcon sx={{ fontSize: 16 }} />
                              Fun Fact:
                            </Typography>
                            <Paper
                              elevation={0}
                              sx={{
                                p: 2.5,
                                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.1)} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontStyle: 'italic', lineHeight: 1.6 }}
                              >
                                {item.fact}
                              </Typography>
                            </Paper>
                          </Box>
                        )}

                        {!item.answered && (
                          <Button
                            variant="contained"
                            onClick={() => startEditing(item)}
                            startIcon={<EditIcon />}
                            size="small"
                            sx={{ mt: 1 }}
                          >
                            Answer This Question
                          </Button>
                        )}

                        {item.answered && !item.skipped && (
                          <Button
                            variant="outlined"
                            onClick={() => startEditing(item)}
                            startIcon={<EditIcon />}
                            size="small"
                            sx={{ mt: 1 }}
                          >
                            Edit Answer
                          </Button>
                        )}
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              </Fade>
            );
          })
        )}
      </Box>
    </Box>
  );
};

export default PersonalQuestionsHistory;
