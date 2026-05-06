// File: frontend/src/components/UpcomingDates/AllCelebrationsDialog.tsx
import CakeIcon from '@mui/icons-material/Cake';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PersonIcon from '@mui/icons-material/Person';
import StarIcon from '@mui/icons-material/Star';
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography,
  IconButton,
  useTheme,
  Chip,
  Alert,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useState, useEffect } from 'react';

import { getCelebrations, deleteCelebration, Celebration } from '../../api/modules/celebrations';
import { createLogger } from '../../utils/logger';
import { LoadingDots } from '../ui/feedback';

const logger = createLogger('AllCelebrationsDialog');

interface AllCelebrationsDialogProps {
  open: boolean;
  onClose: () => void;
  currentUserId: string;
  onDeleted: () => void;
  refreshTrigger?: number;
}

type FilterType = 'all' | 'added' | 'facts';

const ICONS: Record<string, React.ReactElement> = {
  birthday: <CakeIcon sx={{ fontSize: 16 }} />,
  anniversary: <FavoriteIcon sx={{ fontSize: 16 }} />,
  holiday: <CelebrationIcon sx={{ fontSize: 16 }} />,
  other: <StarIcon sx={{ fontSize: 16 }} />,
};

const AllCelebrationsDialog: React.FC<AllCelebrationsDialogProps> = ({
  open, onClose, currentUserId, onDeleted, refreshTrigger,
}) => {
  const theme = useTheme();
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => { if (open) fetchCelebrations(); }, [open, refreshTrigger]);

  const fetchCelebrations = async () => {
    try {
      setLoading(true); setError(null);
      const response = await getCelebrations();
      setCelebrations([...response.celebrations].sort((a, b) => {
        const [am, ad] = a.date.split('/').map(Number);
        const [bm, bd] = b.date.split('/').map(Number);
        return am !== bm ? am - bm : ad - bd;
      }));
    } catch (err) {
      logger.error('Failed to fetch celebrations', err);
      setError('Failed to load celebrations');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (c: Celebration) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    setDeleting(c.id);
    try {
      await deleteCelebration(c.id, currentUserId);
      await fetchCelebrations(); onDeleted();
    } catch { setError('Failed to delete'); }
    finally { setDeleting(null); }
  };

  const fmt = (dateStr: string) => {
    const [m, d] = dateStr.split('/');
    return new Date(2024, parseInt(m) - 1, parseInt(d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const typeColor = (t: string) => ({
    birthday: theme.palette.primary.main,
    anniversary: theme.palette.error.main,
    holiday: theme.palette.success.main,
    other: theme.palette.warning.main,
  }[t] || theme.palette.text.secondary);

  const manual = celebrations.filter(c => !c.isFromFacts);
  const facts = celebrations.filter(c => c.isFromFacts);
  const filtered = filter === 'all' ? celebrations : filter === 'added' ? manual : facts;

  // Group by month
  const byMonth: Record<string, Celebration[]> = {};
  for (const c of filtered) {
    const [m] = c.date.split('/');
    const monthName = new Date(2024, parseInt(m) - 1).toLocaleDateString('en-US', { month: 'long' });
    (byMonth[monthName] ||= []).push(c);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', maxHeight: '80vh' } }}>

      {/* Header */}
      <Box sx={{
        px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${alpha(theme.palette.warning.main, 0.1)}, ${alpha(theme.palette.warning.dark, 0.05)})`,
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthIcon sx={{ fontSize: 20, color: theme.palette.warning.main }} />
          <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>All Celebrations</Typography>
          {!loading && <Chip label={celebrations.length} size="small"
            sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: alpha(theme.palette.warning.main, 0.12), color: theme.palette.warning.dark }} />}
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: theme.palette.text.secondary }}>
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Filter tabs */}
      <Box sx={{ display: 'flex', gap: 0.5, px: 2, py: 1, bgcolor: alpha(theme.palette.divider, 0.04) }}>
        {([
          { key: 'all', label: 'All' },
          { key: 'added', label: `Added (${manual.length})` },
          { key: 'facts', label: `From Facts (${facts.length})` },
        ] as const).map(({ key, label }) => (
          <Box key={key} onClick={() => setFilter(key)} sx={{
            px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer', transition: 'all 0.2s',
            bgcolor: filter === key ? theme.palette.background.paper : 'transparent',
            boxShadow: filter === key ? `0 1px 3px ${alpha('#000', 0.08)}` : 'none',
            '&:hover': filter !== key ? { bgcolor: alpha(theme.palette.background.paper, 0.5) } : {},
          }}>
            <Typography sx={{
              fontSize: '0.7rem', fontWeight: filter === key ? 700 : 500,
              color: filter === key ? theme.palette.text.primary : theme.palette.text.secondary,
            }}>{label}</Typography>
          </Box>
        ))}
      </Box>

      {/* Content */}
      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <LoadingDots mt={4} />
        ) : error ? (
          <Alert severity="error" sx={{ m: 2, fontSize: '0.8rem' }}>{error}</Alert>
        ) : filtered.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4, fontSize: '0.85rem' }}>
            No celebrations found
          </Typography>
        ) : (
          Object.entries(byMonth).map(([month, items]) => (
            <Box key={month}>
              {/* Month header */}
              <Box sx={{
                px: 2, py: 0.75,
                bgcolor: alpha(theme.palette.primary.main, 0.04),
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
              }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: theme.palette.primary.main, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {month}
                </Typography>
              </Box>

              {/* Items */}
              {items.map((c) => (
                <Box key={c.id} sx={{
                  px: 2, py: 1.25,
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`,
                  ...(c.isFromFacts && { borderLeft: `3px solid ${alpha(theme.palette.info.main, 0.4)}` }),
                  '&:hover': { bgcolor: alpha(theme.palette.action.hover, 0.04) },
                }}>
                  {/* Icon */}
                  <Box sx={{ color: typeColor(c.type), flexShrink: 0 }}>
                    {ICONS[c.type] || ICONS.other}
                  </Box>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600 }}>{c.name}</Typography>
                      <Chip label={c.type} size="small" sx={{
                        height: 18, fontSize: '0.55rem', fontWeight: 600,
                        bgcolor: alpha(typeColor(c.type), 0.1), color: typeColor(c.type),
                      }} />
                      {!c.recurring && <Chip label="one-time" size="small" variant="outlined" sx={{ height: 18, fontSize: '0.55rem' }} />}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.25 }}>
                      <Typography sx={{ fontSize: '0.7rem', color: theme.palette.text.secondary }}>
                        {fmt(c.date)}
                        {c.year && c.type === 'anniversary' && ` · Since ${c.year}`}
                        {c.year && !c.recurring && ` · ${c.year}`}
                      </Typography>
                    </Box>
                    {c.description && (
                      <Typography sx={{ fontSize: '0.65rem', color: theme.palette.text.disabled, fontStyle: 'italic', mt: 0.25 }}>
                        {c.description}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, mt: 0.25 }}>
                      <PersonIcon sx={{ fontSize: 11, color: theme.palette.text.disabled }} />
                      <Typography sx={{ fontSize: '0.6rem', color: theme.palette.text.disabled }}>
                        {c.isFromFacts ? 'From facts' : c.addedByName || c.addedBy}
                      </Typography>
                    </Box>
                  </Box>

                  {/* Delete */}
                  {c.addedBy === currentUserId && !c.isFromFacts && (
                    <IconButton size="small" onClick={() => handleDelete(c)}
                      disabled={deleting === c.id}
                      sx={{ color: theme.palette.text.disabled, flexShrink: 0,
                        '&:hover': { color: theme.palette.error.main } }}>
                      {deleting === c.id ? <LoadingDots size={4} inline /> : <DeleteIcon sx={{ fontSize: 16 }} />}
                    </IconButton>
                  )}
                </Box>
              ))}
            </Box>
          ))
        )}
      </DialogContent>

      {/* Footer */}
      <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, textAlign: 'right' }}>
        <Button onClick={onClose} size="small" variant="outlined">Close</Button>
      </Box>
    </Dialog>
  );
};

export default AllCelebrationsDialog;
