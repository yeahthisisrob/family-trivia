// File: frontend/src/components/Admin/GroupsTab.tsx
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupIcon from '@mui/icons-material/Group';
import {
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
import React, { useState } from 'react';

import { useAdmin } from '../../contexts/AdminContext';

interface GroupForm {
  groupId: string;
  name: string;
  description: string;
  side: string;
}

const EMPTY_FORM: GroupForm = { groupId: '', name: '', description: '', side: '' };

const GroupsTab: React.FC = () => {
  const admin = useAdmin();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<GroupForm>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const sideOptions = Object.entries(admin.sides).map(([id, s]) => ({
    id,
    name: s.name,
  }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditMode(false);
    setDialogOpen(true);
  };

  const openEdit = (g: (typeof admin.groups)[0]) => {
    setForm({
      groupId: g.groupId,
      name: g.name,
      description: g.description || '',
      side: g.side || '',
    });
    setEditMode(true);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      if (editMode) {
        await admin.updateGroup({
          groupId: form.groupId,
          name: form.name,
          description: form.description || undefined,
          side: form.side || undefined,
        });
      } else {
        await admin.addGroup({
          groupId: form.groupId,
          name: form.name,
          description: form.description || undefined,
          side: form.side || undefined,
        });
      }
      setDialogOpen(false);
    } catch {
      // error handled by context
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await admin.deleteGroup(confirmDelete);
      setConfirmDelete(null);
    } catch {
      // error handled by context
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small">
          Add Group
        </Button>
      </Box>

      <Grid container spacing={2}>
        {(admin.groups || []).map((g) => {
          const sideData = g.side ? admin.sides[g.side] : null;
          return (
            <Grid item xs={12} sm={6} key={g.groupId}>
              <Card variant="outlined">
                <CardContent sx={{ pb: '12px !important' }}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <GroupIcon fontSize="small" sx={{ color: sideData?.color || 'grey.500' }} />
                      <Typography variant="subtitle2" fontWeight="bold">
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
                      color="text.secondary"
                      sx={{ mt: 0.5, fontStyle: 'italic' }}
                    >
                      {g.description}
                    </Typography>
                  )}

                  <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {sideData && (
                      <Chip
                        label={sideData.name}
                        size="small"
                        sx={{ bgcolor: sideData.color, color: '#fff' }}
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
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
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
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Members in this group
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {admin.players
                  .filter((p) => p.group === form.groupId)
                  .map((p) => (
                    <Chip key={p.userId} label={p.userId} size="small" color="primary" variant="outlined" />
                  ))}
                {(admin.players || []).filter((p) => p.group === form.groupId).length === 0 && (
                  <Typography variant="caption" color="text.secondary">None</Typography>
                )}
              </Box>
            </Box>
          )}

          {/* Unassigned players */}
          {(() => {
            const assignedGroups = new Set((admin.groups || []).map((g) => g.groupId));
            const unassigned = (admin.players || []).filter((p) => !p.group || !assignedGroups.has(p.group));
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
                      onClick={async () => {
                        await admin.updatePlayer({ userId: p.userId, group: form.groupId });
                      }}
                      title={`Click to assign ${p.userId} to ${form.groupId}`}
                    />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Tap a player to assign them to this group
                </Typography>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.groupId || !form.name}>
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

export default GroupsTab;
