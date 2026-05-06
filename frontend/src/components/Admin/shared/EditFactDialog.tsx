// Admin: edit a fact history entry. Shows ALL fields in one place —
// question text, answer, type, index, date — with an explicit Save button.
// Replaces the old chip-click-to-swap UX that caused accidental mutations.

import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import React, { useEffect, useState } from 'react';

export interface FactEntryLike {
  timestamp: string;
  date: string;
  question: string;
  answer: string;
  questionType?: 'shared' | 'basic';
  questionIndex?: number;
  skipped?: boolean;
}

export interface FactEdit {
  answer?: string;
  question?: string;
  newQuestionType?: 'shared' | 'basic';
  newQuestionIndex?: number;
  newDate?: string;
}

export interface EditFactDialogProps {
  open: boolean;
  fact: FactEntryLike | null;
  onClose: () => void;
  onSave: (changes: FactEdit) => void | Promise<void>;
  saving?: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const EditFactDialog: React.FC<EditFactDialogProps> = ({ open, fact, onClose, onSave, saving }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [questionType, setQuestionType] = useState<'shared' | 'basic'>('shared');
  const [questionIndex, setQuestionIndex] = useState<string>('');
  const [date, setDate] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);

  // Sync state with incoming fact when dialog opens
  useEffect(() => {
    if (!fact) return;
    setQuestion(fact.question || '');
    setAnswer(fact.answer || '');
    setQuestionType(fact.questionType || 'basic');
    setQuestionIndex(fact.questionIndex !== undefined ? String(fact.questionIndex) : '');
    setDate(fact.date || '');
    setDateError(null);
  }, [fact]);

  if (!fact) return null;

  const changes: FactEdit = {};
  if (answer !== fact.answer) changes.answer = answer;
  if (question !== fact.question) changes.question = question;
  if (questionType !== fact.questionType) changes.newQuestionType = questionType;
  if (questionType === 'basic' && questionIndex !== String(fact.questionIndex ?? '')) {
    const n = parseInt(questionIndex, 10);
    if (!Number.isNaN(n)) changes.newQuestionIndex = n;
  }
  if (date !== fact.date) changes.newDate = date;

  const hasChanges = Object.keys(changes).length > 0;
  const typeChanged = !!changes.newQuestionType;

  const validate = (): boolean => {
    if (date && !ISO_DATE.test(date)) {
      setDateError('Date must be YYYY-MM-DD');
      return false;
    }
    setDateError(null);
    return true;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(changes);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Edit Fact Entry</Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: 'monospace' }}>
            {fact.timestamp}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} disabled={saving}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Question" value={question}
            onChange={e => setQuestion(e.target.value)}
            multiline minRows={2} maxRows={4}
            size="small" fullWidth
            InputProps={{ sx: { fontSize: '0.85rem' } }}
          />
          <TextField
            label="Answer" value={answer}
            onChange={e => setAnswer(e.target.value)}
            multiline minRows={2} maxRows={4}
            size="small" fullWidth
            InputProps={{ sx: { fontSize: '0.85rem' } }}
            helperText={fact.skipped ? 'This entry is marked as skipped' : undefined}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type" value={questionType}
                onChange={e => setQuestionType(e.target.value as 'shared' | 'basic')}
              >
                <MenuItem value="shared">shared</MenuItem>
                <MenuItem value="basic">basic</MenuItem>
              </Select>
            </FormControl>
            {questionType === 'basic' && (
              <TextField
                label="Index" type="number" size="small"
                value={questionIndex}
                onChange={e => setQuestionIndex(e.target.value)}
                sx={{ width: 100 }}
                inputProps={{ min: 0 }}
              />
            )}
          </Box>
          <TextField
            label="Date (YYYY-MM-DD)" value={date}
            onChange={e => setDate(e.target.value)}
            size="small" fullWidth
            error={!!dateError}
            helperText={dateError || 'Original question date — affects catchup dedup'}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
          />
          {typeChanged && (
            <Alert severity="warning" sx={{ fontSize: '0.78rem' }}>
              Changing type from <strong>{fact.questionType}</strong> to{' '}
              <strong>{questionType}</strong>. This affects how the entry counts toward
              basic-question completion and catchup dedup.
            </Alert>
          )}
          {hasChanges && (
            <Box sx={{ p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, mb: 0.5 }}>
                Pending changes ({Object.keys(changes).length}):
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontFamily: 'monospace', whiteSpace: 'pre' }}>
                {JSON.stringify(changes, null, 2)}
              </Typography>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave}
          disabled={!hasChanges || saving}
          startIcon={<SaveIcon />}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditFactDialog;
