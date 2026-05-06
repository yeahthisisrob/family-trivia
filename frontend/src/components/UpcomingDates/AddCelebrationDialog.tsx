// File: frontend/src/components/UpcomingDates/AddCelebrationDialog.tsx
import CakeIcon from '@mui/icons-material/Cake';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CloseIcon from '@mui/icons-material/Close';
import FavoriteIcon from '@mui/icons-material/Favorite';
import StarIcon from '@mui/icons-material/Star';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  Alert,
  IconButton,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs, { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import React, { useState } from 'react';

import { addCelebration } from '../../api/modules/celebrations';
import { createLogger } from '../../utils/logger';

dayjs.extend(utc);
dayjs.extend(timezone);

const logger = createLogger('AddCelebrationDialog');

interface AddCelebrationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}

const TYPES = [
  { value: 'birthday', label: 'Birthday', icon: <CakeIcon sx={{ fontSize: 18 }} />, hint: 'Person or pet birthday' },
  { value: 'anniversary', label: 'Anniversary', icon: <FavoriteIcon sx={{ fontSize: 18 }} />, hint: 'Wedding, dating, or milestone' },
  { value: 'holiday', label: 'Holiday', icon: <CelebrationIcon sx={{ fontSize: 18 }} />, hint: 'Family tradition or holiday' },
  { value: 'other', label: 'Event', icon: <StarIcon sx={{ fontSize: 18 }} />, hint: '5K race, vacation, reunion' },
];

const AddCelebrationDialog: React.FC<AddCelebrationDialogProps> = ({
  open, onClose, onSuccess, currentUserId,
}) => {
  const theme = useTheme();
  const [type, setType] = useState<'birthday' | 'anniversary' | 'holiday' | 'other'>('birthday');
  const [name, setName] = useState('');
  const [date, setDate] = useState<Dayjs | null>(dayjs().startOf('day'));
  const [description, setDescription] = useState('');
  const [year, setYear] = useState('');
  const [recurring, setRecurring] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !date) { setError('Name and date are required'); return; }
    if (!recurring && !year) { setError('One-time events need a year'); return; }

    setLoading(true); setError(null);
    try {
      const month = String(date.month() + 1).padStart(2, '0');
      const day = String(date.date()).padStart(2, '0');
      await addCelebration({
        type, name: name.trim(), date: `${month}/${day}`,
        description: description.trim(), addedBy: currentUserId,
        recurring, year: year ? parseInt(year, 10) : undefined,
      });
      setType('birthday'); setName(''); setDate(dayjs().startOf('day'));
      setDescription(''); setYear(''); setRecurring(true);
      onSuccess(); onClose();
    } catch (err) {
      logger.error('Failed to add celebration', err);
      setError('Failed to add. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentType = TYPES.find(t => t.value === type)!;

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

        {/* Header */}
        <Box sx={{
          px: 2.5, py: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)}, ${alpha(theme.palette.warning.dark, 0.05)})`,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CelebrationIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
            <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>Add Celebration</Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: theme.palette.text.secondary }}>
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        <DialogContent sx={{ pt: 2.5, pb: 1 }}>
          {error && <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2, fontSize: '0.8rem' }}>{error}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Type chips */}
            <Box>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: theme.palette.text.secondary, mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Type
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {TYPES.map(t => (
                  <Box key={t.value} onClick={() => {
                    setType(t.value as typeof type);
                    setRecurring(t.value !== 'other');
                  }} sx={{
                    display: 'flex', alignItems: 'center', gap: 0.5,
                    px: 1.5, py: 0.75, borderRadius: 2, cursor: 'pointer',
                    transition: 'all 0.2s',
                    bgcolor: type === t.value ? alpha(theme.palette.warning.main, 0.1) : alpha(theme.palette.divider, 0.06),
                    border: `1.5px solid ${type === t.value ? theme.palette.warning.main : 'transparent'}`,
                    color: type === t.value ? theme.palette.text.primary : theme.palette.text.secondary,
                    '&:hover': { bgcolor: alpha(theme.palette.warning.main, 0.06) },
                  }}>
                    {t.icon}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: type === t.value ? 700 : 500 }}>
                      {t.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled, mt: 0.5, fontStyle: 'italic' }}>
                {currentType.hint}
              </Typography>
            </Box>

            <TextField label={type === 'birthday' ? "Name" : 'Event Name'} value={name}
              onChange={(e) => setName(e.target.value)} fullWidth required size="small"
              placeholder={type === 'birthday' ? 'e.g., Max the Dog' : type === 'other' ? 'e.g., Turkey Trot 5K' : 'e.g., Our Anniversary'} />

            <DatePicker label="Date" value={date} onChange={(d) => d && setDate(d)}
              views={['month', 'day']} format="MMMM D"
              slotProps={{ textField: { fullWidth: true, required: true, size: 'small' } }} />

            {/* Year — for non-recurring or anniversaries */}
            {(!recurring || type === 'anniversary') && (
              <TextField label={type === 'anniversary' ? 'Year Started' : 'Year'}
                value={year} onChange={(e) => setYear(e.target.value)}
                type="number" fullWidth size="small" required={!recurring}
                placeholder={`e.g., ${new Date().getFullYear()}`} />
            )}

            <TextField label="Note (optional)" value={description}
              onChange={(e) => setDescription(e.target.value)} fullWidth size="small"
              placeholder="e.g., Loves chocolate cake!" />

            <FormControlLabel
              control={<Switch checked={recurring} onChange={(e) => setRecurring(e.target.checked)} size="small" />}
              label={<Typography sx={{ fontSize: '0.8rem' }}>Repeats every year</Typography>}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={onClose} disabled={loading} size="small">Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" size="small"
            disabled={loading || !name.trim() || !date}
            sx={{ bgcolor: theme.palette.warning.main, '&:hover': { bgcolor: theme.palette.warning.dark } }}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddCelebrationDialog;
