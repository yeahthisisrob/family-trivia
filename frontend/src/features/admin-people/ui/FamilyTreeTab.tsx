/** Admin › Family Tree: the hierarchy's root partners and its sides. */
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
import type React from 'react';
import { useState } from 'react';
import { LoadingDots } from '../../../components/ui/feedback';
import { problemOf } from '../../../shared/admin-ui';
import { colors } from '../../../shared/design-system';
import {
  type FamilyTree,
  type RootPartner,
  type Side,
  useFamilyTree,
  useSaveFamilyTree,
} from '../model/people';

export const FamilyTreeTab: React.FC = () => {
  const read = useFamilyTree();
  if (read.isPending) return <LoadingDots mt={3} />;
  if (!read.data)
    return <Alert severity="error">The family tree didn't load. Try again in a moment.</Alert>;
  return <TreeEditor tree={read.data} />;
};

/** Edits a copy of the tree; a newer tree from the server starts the copy over. */
const TreeEditor: React.FC<{ tree: FamilyTree }> = ({ tree }) => {
  const saving = useSaveFamilyTree();
  const [syncedFrom, setSyncedFrom] = useState(tree);
  const [partners, setPartners] = useState<RootPartner[]>(tree.rootPartners);
  const [editSides, setEditSides] = useState<Record<string, Side>>(() =>
    structuredClone(tree.sides),
  );
  const [saved, setSaved] = useState(false);

  if (syncedFrom !== tree) {
    setSyncedFrom(tree);
    setPartners(tree.rootPartners);
    setEditSides(structuredClone(tree.sides));
  }

  // A copy of the partner changed, never the server's answer in the cache.
  const handlePartnerChange = (idx: number, field: keyof RootPartner, value: string) =>
    setPartners((list) => list.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));

  const handleSideChange = (sideId: string, field: keyof Side, value: string) => {
    setEditSides((prev) => ({
      ...prev,
      [sideId]: { ...prev[sideId], [field]: value },
    }));
  };

  const addSide = () => {
    const id = `side-${Date.now()}`;
    setEditSides((prev) => ({
      ...prev,
      [id]: { id, name: 'New Side', color: colors.defaultUser, groups: [] },
    }));
  };

  const removeSide = (sideId: string) => {
    setEditSides((prev) => {
      const next = { ...prev };
      delete next[sideId];
      return next;
    });
  };

  const handleSave = () =>
    saving.mutate(
      { rootPartners: partners, sides: editSides },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        },
      },
    );

  return (
    <Box>
      {saved && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Family tree configuration saved.
        </Alert>
      )}
      {saving.error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {problemOf(saving.error)}
        </Alert>
      )}

      {/* Root Partners */}
      <Typography
        variant="subtitle1"
        gutterBottom
        sx={{
          fontWeight: 'bold',
        }}
      >
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
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 'bold',
          }}
        >
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

            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
                mb: 0.5,
              }}
            >
              Groups assigned to this side:
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {sideData.groups.length > 0 ? (
                sideData.groups.map((gId) => <Chip key={gId} label={gId} size="small" />)
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    color: 'text.secondary',
                    fontStyle: 'italic',
                  }}
                >
                  No groups assigned. Assign groups in the Groups tab.
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      ))}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving.isPending}
        >
          Save Family Tree
        </Button>
      </Box>
    </Box>
  );
};
