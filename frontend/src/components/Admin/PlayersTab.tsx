// File: frontend/src/components/Admin/PlayersTab.tsx
// Player management — card grid, mobile-first.

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import ShieldIcon from '@mui/icons-material/Shield';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import React, { useState } from 'react';

import AdminCard from './shared/AdminCard';
import ConfirmDialog from './shared/ConfirmDialog';
import EmptyState from './shared/EmptyState';
import { useAdmin } from '../../contexts/AdminContext';

interface PlayerForm {
  userId: string;
  group: string;
  color: string;
  passphrase: string;
  isAdmin: boolean;
}

const EMPTY_FORM: PlayerForm = {
  userId: '', group: '', color: '#4CAF50', passphrase: '', isAdmin: false,
};

const PlayersTab: React.FC = () => {
  const admin = useAdmin();
  const theme = useTheme();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<PlayerForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openAdd = () => { setForm(EMPTY_FORM); setEditMode(false); setDialogOpen(true); };
  const openEdit = (p: (typeof admin.players)[0]) => {
    setForm({ userId: p.userId, group: p.group, color: p.color, passphrase: p.passphrase || '', isAdmin: !!p.isAdmin });
    setEditMode(true); setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data = { userId: form.userId, group: form.group, color: form.color, passphrase: form.passphrase || undefined, isAdmin: form.isAdmin };
      if (editMode) await admin.updatePlayer(data);
      else await admin.addPlayer(data);
      setDialogOpen(false);
    } catch { /* context handles error */ }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try { await admin.deletePlayer(confirmDelete); setConfirmDelete(null); } catch { /* */ }
  };

  const groupName = (gid: string) => admin.groups?.find(g => g.groupId === gid)?.name || gid;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">
          Add Player
        </Button>
      </Box>

      {(admin.players || []).length === 0 ? (
        <EmptyState icon={<PersonIcon sx={{ fontSize: 'inherit' }} />} message="No players configured" />
      ) : (
        <Grid container spacing={1}>
          {(admin.players || []).map(p => (
            <Grid item xs={12} sm={6} key={p.userId}>
              <AdminCard
                title={p.userId}
                badge={p.isAdmin ? (
                  <Chip icon={<ShieldIcon sx={{ fontSize: '12px !important' }} />}
                    label="Admin" size="small"
                    sx={{ height: 20, fontSize: '0.6rem', bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main }} />
                ) : undefined}
                actions={
                  <>
                    <IconButton size="small" onClick={() => openEdit(p)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => setConfirmDelete(p.userId)}>
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </>
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{
                    width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
                    bgcolor: p.color, border: `1px solid ${alpha('#000', 0.15)}`,
                  }} />
                  <Chip label={groupName(p.group)} size="small"
                    sx={{ height: 20, fontSize: '0.65rem' }} />
                </Box>
              </AdminCard>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
          {editMode ? 'Edit Player' : 'Add Player'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}>
          <TextField label="User ID" value={form.userId}
            onChange={e => setForm({ ...form, userId: e.target.value })}
            fullWidth size="small" disabled={editMode} />
          <FormControl fullWidth size="small">
            <InputLabel>Group</InputLabel>
            <Select value={form.group} label="Group"
              onChange={e => setForm({ ...form, group: e.target.value })}>
              {(admin.groups || []).map(g => (
                <MenuItem key={g.groupId} value={g.groupId}>{g.name} ({g.groupId})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Color" type="color" value={form.color}
            onChange={e => setForm({ ...form, color: e.target.value })} fullWidth size="small" />
          <TextField label="Passphrase" value={form.passphrase}
            onChange={e => setForm({ ...form, passphrase: e.target.value })} fullWidth size="small" />
          <FormControlLabel
            control={<Switch checked={form.isAdmin} onChange={e => setForm({ ...form, isAdmin: e.target.checked })} />}
            label={<Typography sx={{ fontSize: '0.85rem' }}>Admin</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">Cancel</Button>
          <Button variant="contained" onClick={() => void handleSave()} size="small" disabled={!form.userId || !form.group}>
            {editMode ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Player"
        message={`Are you sure you want to delete "${confirmDelete}"?`}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  );
};

export default PlayersTab;
