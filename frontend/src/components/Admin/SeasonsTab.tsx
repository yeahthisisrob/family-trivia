// File: frontend/src/components/Admin/SeasonsTab.tsx
// Season management — hero card for active season, card list for others.

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useState } from 'react';

import AdminCard from './shared/AdminCard';
import ConfirmDialog from './shared/ConfirmDialog';
import EmptyState from './shared/EmptyState';
import { useAdmin } from '../../contexts/AdminContext';

interface SeasonForm {
  seasonNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
  message: string;
}

const EMPTY_FORM: SeasonForm = {
  seasonNumber: 0, name: '', startDate: '', endDate: '', status: 'upcoming', message: '',
};

const statusColors: Record<string, 'success' | 'warning' | 'default'> = {
  active: 'success', concluded: 'default', upcoming: 'warning',
};

const SeasonsTab: React.FC = () => {
  const admin = useAdmin();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<SeasonForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const openAdd = () => {
    const next = admin.seasons.length > 0 ? Math.max(...admin.seasons.map(s => s.seasonNumber)) + 1 : 1;
    setForm({ ...EMPTY_FORM, seasonNumber: next });
    setEditMode(false);
    setDialogOpen(true);
  };

  const openEdit = (s: (typeof admin.seasons)[0]) => {
    setForm({
      seasonNumber: s.seasonNumber, name: s.name, startDate: s.startDate,
      endDate: s.endDate || '', status: s.status, message: s.message || '',
    });
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = {
        seasonNumber: form.seasonNumber, name: form.name, startDate: form.startDate,
        endDate: form.endDate || undefined, status: form.status, message: form.message || undefined,
      };
      if (editMode) await admin.updateSeason(data);
      else await admin.addSeason(data);
      setDialogOpen(false);
    } catch { /* context handles error */ }
  };

  const handleDelete = async () => {
    if (confirmDelete === null) return;
    try { await admin.deleteSeason(confirmDelete); setConfirmDelete(null); } catch { /* */ }
  };

  const handleSetActive = async (n: number) => {
    try { await admin.updateSeason({ currentSeasonNumber: n }); } catch { /* */ }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return d; }
  };

  const active = admin.seasons.find(s => s.seasonNumber === admin.currentSeasonNumber);
  const others = admin.seasons.filter(s => s.seasonNumber !== admin.currentSeasonNumber)
    .sort((a, b) => b.seasonNumber - a.seasonNumber);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">
          Add Season
        </Button>
      </Box>

      {/* Active season — hero card */}
      {active ? (
        <AdminCard
          highlighted
          title={active.name}
          badge={<Chip label="Active" size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />}
          actions={
            <IconButton size="small" onClick={() => openEdit(active)}>
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
          }
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
              Started {formatDate(active.startDate)}
            </Typography>
            {active.endDate && (
              <Typography sx={{ fontSize: '0.75rem', color: theme.palette.text.secondary }}>
                Ends {formatDate(active.endDate)}
              </Typography>
            )}
          </Box>
          {active.message && (
            <Typography sx={{ fontSize: '0.72rem', mt: 1, fontStyle: 'italic', color: theme.palette.text.secondary }}>
              {active.message}
            </Typography>
          )}
        </AdminCard>
      ) : (
        <AdminCard highlighted title="No Active Season">
          <Typography sx={{ fontSize: '0.8rem', color: theme.palette.text.secondary }}>
            Between seasons. Add or activate a season.
          </Typography>
        </AdminCard>
      )}

      {/* Other seasons */}
      {others.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {others.map(s => (
            <AdminCard
              key={s.seasonNumber}
              title={s.name}
              subtitle={`${formatDate(s.startDate)}${s.endDate ? ` — ${formatDate(s.endDate)}` : ''}`}
              badge={<Chip label={s.status} size="small" color={statusColors[s.status] || 'default'} sx={{ height: 20, fontSize: '0.6rem' }} />}
              actions={
                <>
                  <Button
                    size="small" startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                    onClick={() => handleSetActive(s.seasonNumber)}
                    sx={{ fontSize: '0.7rem', textTransform: 'none', minHeight: 0, py: 0.25 }}
                  >
                    Activate
                  </Button>
                  <IconButton size="small" onClick={() => openEdit(s)}>
                    <EditIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => setConfirmDelete(s.seasonNumber)}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </>
              }
            >
              {s.message && (
                <Typography sx={{ fontSize: '0.72rem', fontStyle: 'italic', color: theme.palette.text.secondary }}>
                  {s.message}
                </Typography>
              )}
            </AdminCard>
          ))}
        </Box>
      )}

      {admin.seasons.length === 0 && (
        <EmptyState message="No seasons configured yet" />
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
          {editMode ? 'Edit Season' : 'Add Season'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <TextField label="Season Number" type="number" value={form.seasonNumber}
            onChange={e => setForm({ ...form, seasonNumber: parseInt(e.target.value, 10) || 0 })}
            fullWidth size="small" disabled={editMode} />
          <TextField label="Name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            fullWidth size="small" />
          <TextField label="Start Date" type="date" value={form.startDate}
            onChange={e => setForm({ ...form, startDate: e.target.value })}
            fullWidth size="small" InputLabelProps={{ shrink: true }} />
          <TextField label="End Date" type="date" value={form.endDate}
            onChange={e => setForm({ ...form, endDate: e.target.value })}
            fullWidth size="small" InputLabelProps={{ shrink: true }} />
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={form.status} label="Status"
              onChange={e => setForm({ ...form, status: e.target.value })}>
              <MenuItem value="upcoming">Upcoming</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="concluded">Concluded</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Message" value={form.message}
            onChange={e => setForm({ ...form, message: e.target.value })}
            fullWidth size="small" multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">Cancel</Button>
          <Button variant="contained" onClick={() => void handleSave()} size="small">
            {editMode ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete Season"
        message={`Are you sure you want to delete season #${confirmDelete}?`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  );
};

export default SeasonsTab;
