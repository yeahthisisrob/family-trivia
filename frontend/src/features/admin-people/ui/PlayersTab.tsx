/** Admin › Players: a card grid of the user config, mobile-first. */
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import ShieldIcon from '@mui/icons-material/Shield';
import {
  Alert,
  alpha,
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
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { AdminCard, ConfirmDialog, EmptyState, problemOf } from '../../../shared/admin-ui';
import { colors } from '../../../shared/design-system';
import {
  type AdminPlayer,
  useAddPlayer,
  useAdminGroups,
  useAdminPlayers,
  useDeletePlayer,
  useUpdatePlayer,
} from '../model/people';

interface PlayerForm {
  userId: string;
  group: string;
  color: string;
  passphrase: string;
  isAdmin: boolean;
}

const EMPTY_FORM: PlayerForm = {
  userId: '',
  group: '',
  color: colors.user[1],
  passphrase: '',
  isAdmin: false,
};

const NO_PLAYERS: AdminPlayer[] = [];

export const PlayersTab: React.FC = () => {
  const theme = useTheme();
  const read = useAdminPlayers();
  const groups = useAdminGroups().data?.groups ?? [];
  const adding = useAddPlayer();
  const updating = useUpdatePlayer();
  const deleting = useDeletePlayer();
  const players = read.data?.players ?? NO_PLAYERS;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<PlayerForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const saving = editMode ? updating : adding;

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditMode(false);
    adding.reset();
    setDialogOpen(true);
  };
  const openEdit = (p: AdminPlayer) => {
    setForm({
      userId: p.userId,
      group: p.group ?? '',
      color: p.color,
      passphrase: p.passphrase || '',
      isAdmin: !!p.isAdmin,
    });
    setEditMode(true);
    updating.reset();
    setDialogOpen(true);
  };

  const handleSave = () => {
    const data = {
      userId: form.userId,
      group: form.group,
      color: form.color,
      passphrase: form.passphrase || undefined,
      isAdmin: form.isAdmin,
    };
    const done = { onSuccess: () => setDialogOpen(false) };
    if (editMode) updating.mutate(data, done);
    else adding.mutate(data, done);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    // Closed either way: a failure shows above the list.
    deleting.mutate(confirmDelete, { onSettled: () => setConfirmDelete(null) });
  };

  const groupName = (gid: string) => groups.find((g) => g.groupId === gid)?.name || gid;

  if (read.isPending) return <LoadingDots mt={3} />;
  if (read.isError && !read.data)
    return <Alert severity="error">Players didn't load. Try again in a moment.</Alert>;

  return (
    <Box>
      {deleting.error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {problemOf(deleting.error)}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">
          Add Player
        </Button>
      </Box>

      {players.length === 0 ? (
        <EmptyState
          icon={<PersonIcon sx={{ fontSize: 'inherit' }} />}
          message="No players configured"
        />
      ) : (
        <Grid container spacing={1}>
          {players.map((p) => (
            <Grid
              key={p.userId}
              size={{
                xs: 12,
                sm: 6,
              }}
            >
              <AdminCard
                title={p.userId}
                badge={
                  p.isAdmin ? (
                    <Chip
                      icon={<ShieldIcon sx={{ fontSize: '12px !important' }} />}
                      label="Admin"
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.6rem',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: theme.palette.primary.main,
                      }}
                    />
                  ) : undefined
                }
                actions={
                  <>
                    <IconButton size="small" onClick={() => openEdit(p)}>
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => setConfirmDelete(p.userId)}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </>
                }
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      flexShrink: 0,
                      bgcolor: p.color,
                      border: `1px solid ${alpha(colors.scrim, 0.15)}`,
                    }}
                  />
                  <Chip
                    label={groupName(p.group ?? '')}
                    size="small"
                    sx={{ height: 20, fontSize: '0.65rem' }}
                  />
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
        <DialogContent
          sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: '8px !important' }}
        >
          {saving.error && <Alert severity="error">{problemOf(saving.error)}</Alert>}
          <TextField
            label="User ID"
            value={form.userId}
            onChange={(e) => setForm({ ...form, userId: e.target.value })}
            fullWidth
            size="small"
            disabled={editMode}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Group</InputLabel>
            <Select
              value={form.group}
              label="Group"
              onChange={(e) => setForm({ ...form, group: e.target.value })}
            >
              {groups.map((g) => (
                <MenuItem key={g.groupId} value={g.groupId}>
                  {g.name} ({g.groupId})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Color"
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            fullWidth
            size="small"
          />
          <TextField
            label="Passphrase"
            value={form.passphrase}
            onChange={(e) => setForm({ ...form, passphrase: e.target.value })}
            fullWidth
            size="small"
          />
          <FormControlLabel
            control={
              <Switch
                checked={form.isAdmin}
                onChange={(e) => setForm({ ...form, isAdmin: e.target.checked })}
              />
            }
            label={<Typography sx={{ fontSize: '0.85rem' }}>Admin</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} size="small">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            size="small"
            disabled={!form.userId || saving.isPending}
          >
            {editMode ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete Player"
        message={`Are you sure you want to delete "${confirmDelete}"?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </Box>
  );
};
