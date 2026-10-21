/**
 * Admin › Player Data: edit one fact history entry. Every field in one place
 * (question, answer, type, index, date) with an explicit Save button and a
 * preview of what changes; a save the server turns down says why here.
 */
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
import type React from 'react';
import { useEffect, useState } from 'react';
import type { AdminFact, FactEdit } from '../model/playerData';

export type FactEntryLike = Pick<AdminFact, 'timestamp' | 'date' | 'question' | 'answer'> &
  Partial<Pick<AdminFact, 'questionType' | 'questionIndex' | 'skipped'>>;

export interface EditFactDialogProps {
  open: boolean;
  fact: FactEntryLike | null;
  onClose: () => void;
  onSave: (changes: FactEdit) => void;
  saving?: boolean;
  /** Why the last save didn't go through. */
  error?: string | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const EditFactDialog: React.FC<EditFactDialogProps> = ({
  open,
  fact,
  onClose,
  onSave,
  saving,
  error,
}) => {
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
  if (answer !== (fact.answer ?? '')) changes.answer = answer;
  if (question !== (fact.question ?? '')) changes.question = question;
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
      <DialogTitle
        sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
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
          {error && (
            <Alert severity="error" sx={{ fontSize: '0.78rem' }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            size="small"
            fullWidth
            slotProps={{
              input: { sx: { fontSize: '0.85rem' } },
            }}
          />
          <TextField
            label="Answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            multiline
            minRows={2}
            maxRows={4}
            size="small"
            fullWidth
            helperText={fact.skipped ? 'This entry is marked as skipped' : undefined}
            slotProps={{
              input: { sx: { fontSize: '0.85rem' } },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as 'shared' | 'basic')}
              >
                <MenuItem value="shared">shared</MenuItem>
                <MenuItem value="basic">basic</MenuItem>
              </Select>
            </FormControl>
            {questionType === 'basic' && (
              <TextField
                label="Index"
                type="number"
                size="small"
                value={questionIndex}
                onChange={(e) => setQuestionIndex(e.target.value)}
                sx={{ width: 100 }}
                slotProps={{
                  htmlInput: { min: 0 },
                }}
              />
            )}
          </Box>
          <TextField
            label="Date (YYYY-MM-DD)"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            size="small"
            fullWidth
            error={!!dateError}
            helperText={dateError || 'Original question date — affects catchup dedup'}
            slotProps={{
              input: { sx: { fontFamily: 'monospace', fontSize: '0.85rem' } },
            }}
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
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
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
