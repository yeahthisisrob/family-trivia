// File: frontend/src/components/Admin/FamilyTreeTab.tsx
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

import { SideConfig } from '../../api/modules/admin';
import { useAdmin } from '../../contexts/AdminContext';

const FamilyTreeTab: React.FC = () => {
  const admin = useAdmin();

  // Track the context values we last synced from, to detect changes
  const [syncedFrom, setSyncedFrom] = useState<{
    rootPartners: typeof admin.rootPartners;
    sides: typeof admin.sides;
  }>({ rootPartners: admin.rootPartners, sides: admin.sides });

  const [partners, setPartners] = useState<{ id: string; name: string; role?: string }[]>(
    admin.rootPartners,
  );
  const [editSides, setEditSides] = useState<Record<string, SideConfig>>(
    () => JSON.parse(JSON.stringify(admin.sides)) as Record<string, SideConfig>,
  );
  const [saved, setSaved] = useState(false);

  // Sync from context: detect when upstream data changes and reset local editable copies
  if (syncedFrom.rootPartners !== admin.rootPartners || syncedFrom.sides !== admin.sides) {
    setSyncedFrom({ rootPartners: admin.rootPartners, sides: admin.sides });
    setPartners(admin.rootPartners);
    setEditSides(JSON.parse(JSON.stringify(admin.sides)));
  }

  const handlePartnerChange = (idx: number, field: string, value: string) => {
    const updated = [...partners];
    (updated[idx] as Record<string, string>)[field] = value;
    setPartners(updated);
  };

  const handleSideChange = (sideId: string, field: keyof SideConfig, value: string) => {
    setEditSides((prev) => ({
      ...prev,
      [sideId]: { ...prev[sideId], [field]: value },
    }));
  };

  const addSide = () => {
    const id = `side-${Date.now()}`;
    setEditSides((prev) => ({
      ...prev,
      [id]: { id, name: 'New Side', color: '#1976d2', groups: [] },
    }));
  };

  const removeSide = (sideId: string) => {
    setEditSides((prev) => {
      const next = { ...prev };
      delete next[sideId];
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await admin.updateFamilyTree({ rootPartners: partners, sides: editSides });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error handled by context
    }
  };

  return (
    <Box>
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Family tree configuration saved.
        </Alert>
      )}

      {/* Root Partners */}
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        Root Partners
      </Typography>
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          {partners.map((p, idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField
                label="ID"
                value={p.id}
                onChange={(e) => handlePartnerChange(idx, 'id', e.target.value)}
                size="small"
              />
              <TextField
                label="Name"
                value={p.name}
                onChange={(e) => handlePartnerChange(idx, 'name', e.target.value)}
                size="small"
              />
              <TextField
                label="Role"
                value={p.role || ''}
                onChange={(e) => handlePartnerChange(idx, 'role', e.target.value)}
                size="small"
              />
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Sides Configuration */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" fontWeight="bold">
          Family Sides
        </Typography>
        <Button size="small" onClick={addSide}>
          Add Side
        </Button>
      </Box>

      {Object.entries(editSides).map(([sideId, sideData]) => (
        <Card key={sideId} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
              <TextField label="Side ID" value={sideId} size="small" disabled sx={{ width: 120 }} />
              <TextField
                label="Name"
                value={sideData.name}
                onChange={(e) => handleSideChange(sideId, 'name', e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Color"
                type="color"
                value={sideData.color}
                onChange={(e) => handleSideChange(sideId, 'color', e.target.value)}
                size="small"
                sx={{ width: 80 }}
              />
              <Button size="small" color="error" onClick={() => removeSide(sideId)}>
                Remove
              </Button>
            </Box>

            <Divider sx={{ my: 1 }} />

            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Groups assigned to this side:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {sideData.groups.length > 0 ? (
                sideData.groups.map((gId) => <Chip key={gId} label={gId} size="small" />)
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  No groups assigned. Assign groups in the Groups tab.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          Save Family Tree
        </Button>
      </Box>
    </Box>
  );
};

export default FamilyTreeTab;
