/**
 * Edit one person: who they are, whether they're playing, how the family
 * remembers them if they've died, and their direct connections.
 */

import type { Family, FamilyPerson, Participation, Tie } from '@family-trivia/shared';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useRef, useState } from 'react';
import { uploadImage } from '../../../api/modules/admin';
import { TieList } from './TieList';

interface PersonDialogProps {
  family: Family;
  person: FamilyPerson;
  isNew: boolean;
  adminUserId: string;
  photoUrls: Record<string, string>;
  onSave: (person: FamilyPerson, ties: Tie[]) => void;
  onRemove?: () => void;
  onClose: () => void;
}

const PARTICIPATION: { value: Participation; label: string; help: string }[] = [
  { value: 'playing', label: 'Playing', help: 'Gets daily questions and shows on leaderboards.' },
  {
    value: 'paused',
    label: 'Paused',
    help: 'Taking a break: no questions, off the leaderboards. Their history stays.',
  },
  {
    value: 'not-playing',
    label: 'Not playing',
    help: 'In the family and the tree, but not in the game.',
  },
];

export const PersonDialog: React.FC<PersonDialogProps> = ({
  family,
  person,
  isNew,
  adminUserId,
  photoUrls,
  onSave,
  onRemove,
  onClose,
}) => {
  const [draft, setDraft] = useState<FamilyPerson>(person);
  const [ties, setTies] = useState<Tie[]>(family.ties);
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const remembered = !!draft.memorial;
  const set = (patch: Partial<FamilyPerson>) => setDraft((d) => ({ ...d, ...patch }));
  const setMemorial = (patch: Partial<NonNullable<FamilyPerson['memorial']>>) =>
    setDraft((d) => ({ ...d, memorial: { ...d.memorial, ...patch } }));

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const key = await uploadImage(adminUserId, file, 'people');
      setMemorial({ photo: key });
      setLocalPhoto(URL.createObjectURL(file));
    } catch {
      setError("The photo didn't upload. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const photo = localPhoto ?? (draft.memorial?.photo ? photoUrls[draft.memorial.photo] : undefined);
  const familyWithDraft: Family = {
    ...family,
    people: { ...family.people, [draft.id]: draft },
    ties,
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 600 }}>{isNew ? 'Add someone' : draft.name}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Name the family uses"
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              helperText="Grandma Jo, Uncle Sam, Alice"
              fullWidth
              required
            />
            <TextField
              label="Full name"
              value={draft.fullName ?? ''}
              onChange={(e) => set({ fullName: e.target.value || undefined })}
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Born"
              placeholder="YYYY-MM-DD or YYYY"
              value={draft.born?.date ?? ''}
              onChange={(e) => set({ born: { ...draft.born, date: e.target.value || undefined } })}
              fullWidth
            />
            <TextField
              label="Born in"
              placeholder="Town, country"
              value={draft.born?.place ?? ''}
              onChange={(e) => set({ born: { ...draft.born, place: e.target.value || undefined } })}
              fullWidth
            />
          </Stack>

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              In the game
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={remembered ? null : draft.participation}
              onChange={(_, v: Participation | null) => v && set({ participation: v })}
              disabled={remembered}
            >
              {PARTICIPATION.map((p) => (
                <ToggleButton key={p.value} value={p.value}>
                  {p.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Typography
              variant="caption"
              sx={{ display: 'block', mt: 0.75, color: 'text.secondary' }}
            >
              {remembered
                ? 'People the family remembers are never asked questions or ranked.'
                : PARTICIPATION.find((p) => p.value === draft.participation)?.help}
            </Typography>
          </Box>

          <FormControlLabel
            control={
              <Switch
                checked={!!draft.noAiMentions}
                onChange={(e) => set({ noAiMentions: e.target.checked || undefined })}
              />
            }
            label="Leave them out of AI-written questions, summaries and stories"
          />

          <Divider />

          <Box>
            <FormControlLabel
              control={
                <Switch
                  checked={remembered}
                  onChange={(e) =>
                    set({ memorial: e.target.checked ? (draft.memorial ?? {}) : undefined })
                  }
                />
              }
              label={<Typography variant="subtitle2">In memory</Typography>}
            />
            {remembered && (
              <Stack spacing={2} sx={{ mt: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Died"
                    placeholder="YYYY-MM-DD or YYYY"
                    value={draft.memorial?.died ?? ''}
                    onChange={(e) => setMemorial({ died: e.target.value || undefined })}
                    fullWidth
                  />
                  <FormControlLabel
                    sx={{ flexShrink: 0 }}
                    control={
                      <Switch
                        checked={!!draft.memorial?.onHome}
                        onChange={(e) => setMemorial({ onHome: e.target.checked || undefined })}
                      />
                    }
                    label="Show on the home page"
                  />
                </Stack>
                <TextField
                  label="Dedication"
                  placeholder="A few words the family chose"
                  multiline
                  minRows={2}
                  value={draft.memorial?.dedication ?? ''}
                  onChange={(e) => setMemorial({ dedication: e.target.value || undefined })}
                  slotProps={{ htmlInput: { maxLength: 500 } }}
                />
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  {photo && (
                    <Box
                      component="img"
                      src={photo}
                      alt=""
                      sx={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 1 }}
                    />
                  )}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    hidden
                    onChange={(e) => onPhoto(e.target.files?.[0])}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<AddPhotoAlternateOutlinedIcon />}
                    onClick={() => fileInput.current?.click()}
                    disabled={busy}
                  >
                    {photo ? 'Change photo' : 'Add a photo'}
                  </Button>
                </Stack>
              </Stack>
            )}
          </Box>

          {!isNew && (
            <>
              <Divider />
              <TieList
                family={familyWithDraft}
                personId={draft.id}
                ties={ties}
                onChange={setTies}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {onRemove && !isNew && (
            <Button color="error" onClick={onRemove}>
              Remove from the family
            </Button>
          )}
        </Box>
        <Box>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!draft.name.trim() || busy}
            onClick={() => onSave({ ...draft, name: draft.name.trim() }, ties)}
          >
            Done
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export const participationLabel = (p: FamilyPerson) =>
  p.memorial
    ? 'In memory'
    : (PARTICIPATION.find((x) => x.value === p.participation)?.label ?? p.participation);
