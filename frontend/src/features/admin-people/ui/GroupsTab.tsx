/** Admin › Groups: the hierarchy's groups, their side and description, and who is in them. */
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupIcon from '@mui/icons-material/Group';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { problemOf } from '../../../shared/admin-ui';
import { colors } from '../../../shared/design-system';
import {
  type AdminGroup,
  type AdminPlayer,
  useAddGroup,
  useAdminGroups,
  useAdminPlayers,
  useDeleteGroup,
  useUpdateGroup,
  useUpdatePlayer,
} from '../model/people';

interface GroupForm {
  groupId: string;
  name: string;
  description: string;
  side: string;
}

const EMPTY_FORM: GroupForm = { groupId: '', name: '', description: '', side: '' };

const NO_GROUPS: AdminGroup[] = [];
const NO_PLAYERS: AdminPlayer[] = [];

export const GroupsTab: React.FC = () => {
  const read = useAdminGroups();
  const players = useAdminPlayers().data?.players ?? NO_PLAYERS;
  const adding = useAddGroup();
  const updating = useUpdateGroup();
  const deleting = useDeleteGroup();
  const assigning = useUpdatePlayer();
  const groups = read.data?.groups ?? NO_GROUPS;
  const sides = read.data?.sides ?? {};
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const saving = editMode ? updating : adding;
  const dialogProblem = problemOf(saving.error ?? assigning.error);

  const sideOptions = Object.entries(sides).map(([id, s]) => ({
    id,
    name: s.name,
  }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditMode(false);
    adding.reset();
    assigning.reset();
    setDialogOpen(true);
  };

  const openEdit = (g: AdminGroup) => {
    setForm({
      groupId: g.groupId,
      name: g.name,
      description: g.description || '',
      side: g.side || '',
    });
    setEditMode(true);
    updating.reset();
    assigning.reset();
    setDialogOpen(true);
  };

  const handleSave = () => {
    const group = {
      groupId: form.groupId,
      name: form.name,
      description: form.description || undefined,
      side: form.side || undefined,
    };
    const done = { onSuccess: () => setDialogOpen(false) };
    if (editMode) updating.mutate(group, done);
    else adding.mutate(group, done);
  };

  const handleDelete = () => {
    if (!confirmDelete) return;
    // Closed either way: a failure (a group with members) shows above the list.
    deleting.mutate(confirmDelete, { onSettled: () => setConfirmDelete(null) });
  };

  if (read.isPending) return <LoadingDots mt={3} />;
  if (read.isError && !read.data)
    return <Alert severity="error">Groups didn't load. Try again in a moment.</Alert>;

  return (
    <Box>
      {deleting.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {problemOf(deleting.error)}
        </Alert>
      )}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">
          Add Group
        </Button>
      </Box>

      <Grid container spacing={2}>
        {groups.map((g) => {
          const sideData = g.side ? sides[g.side] : null;
          return (
            <Grid
              key={g.groupId}
              size={{
                xs: 12,
                sm: 6,
              }}
            >
              <Card variant="outlined">
                <CardContent sx={{ pb: '12px !important' }}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon fontSize="small" sx={{ color: sideData?.color || 'grey.500' }} />
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 'bold',
                        }}
                      >
                        {g.name}
                      </Typography>
                    </Box>
                    <Box>
                      <IconButton size="small" onClick={() => openEdit(g)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => setConfirmDelete(g.groupId)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>

                  {g.description && (
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        mt: 0.5,
                        fontStyle: 'italic',
                      }}
                    >
                      {g.description}
                    </Typography>
                  )}

                  <Box
                    sx={{
                      mt: 1,
                      display: 'flex',
                      gap: 0.5,
                      flexWrap: 'wrap',
                      alignItems: 'center',
                    }}
                  >
                    {sideData && (
                      <Chip
                        label={sideData.name}
                        size="small"
                        sx={{ bgcolor: sideData.color, color: colors.onColor }}
                      />
                    )}
                  </Box>

                  {/* Members list */}
                  {g.members && g.members.length > 0 && (
                    <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {g.members.map((m) => (
                        <Chip key={m} label={m} size="small" variant="outlined" />
                      ))}
                    </Box>
                  )}
                  {(!g.members || g.members.length === 0) && (
                    <Typography
                      variant="caption"
                      sx={{
                        color: 'text.secondary',
                        mt: 0.5,
                        display: 'block',
                      }}
                    >
                      No members assigned
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{editMode ? 'Edit Group' : 'Add Group'}</DialogTitle>
        <DialogContent>
          {dialogProblem && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {dialogProblem}
            </Alert>
          )}
          <TextField
            label="Group ID"
            value={form.groupId}
            onChange={(e) => setForm({ ...form, groupId: e.target.value })}
            fullWidth
            margin="dense"
            disabled={editMode}
            size="small"
          />
          <TextField
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            fullWidth
            margin="dense"
            size="small"
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            fullWidth
            margin="dense"
            size="small"
            multiline
            rows={2}
          />
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>Side</InputLabel>
            <Select
              value={form.side}
              label="Side"
              onChange={(e) => setForm({ ...form, side: e.target.value })}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {sideOptions.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  {s.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Members in this group */}
          {editMode && (
            <Box sx={{ mt: 2 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                }}
              >
                Members in this group
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {players
                  .filter((p) => p.group === form.groupId)
                  .map((p) => (
                    <Chip
                      key={p.userId}
                      label={p.userId}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                {players.filter((p) => p.group === form.groupId).length === 0 && (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                    }}
                  >
                    None
                  </Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Unassigned players */}
          {(() => {
            const assignedGroups = new Set(groups.map((g) => g.groupId));
            const unassigned = players.filter((p) => !p.group || !assignedGroups.has(p.group));
            if (unassigned.length === 0) return null;
            return (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>
                  Unassigned players ({unassigned.length})
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {unassigned.map((p) => (
                    <Chip
                      key={p.userId}
                      label={`${p.userId}${p.group ? ` (${p.group})` : ''}`}
                      size="small"
                      color="warning"
                      variant="outlined"
                      onClick={() => assigning.mutate({ userId: p.userId, group: form.groupId })}
                      title={`Click to assign ${p.userId} to ${form.groupId}`}
                    />
                  ))}
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    mt: 0.5,
                    display: 'block',
                  }}
                >
                  Tap a player to assign them to this group
                </Typography>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!form.groupId || !form.name || saving.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)}>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          Are you sure you want to delete &quot;{confirmDelete}&quot;? The group must be empty.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
