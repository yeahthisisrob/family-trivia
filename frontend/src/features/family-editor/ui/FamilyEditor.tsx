/**
 * Admin › Family: everyone in the family, who's playing, who the family
 * remembers, how people are connected, and the households they belong to.
 * Changes stay local until "Save family"; the server keeps the version each
 * save replaces.
 */

import {
  type Family,
  type FamilyPerson,
  type Household,
  isRemembered,
  playingPeople,
  rememberedPeople,
  type Tie,
  tieTouches,
} from '@family-trivia/shared';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useCircleWords } from '../../../entities/circle';
import { familyApi, useFamily } from '../../../entities/family';
import { ApiError } from '../../../shared/api/ApiService';
import { loadCircles } from '../../../shared/session/session';
import { archiveApi } from '../../family-archive';
import { PersonDialog, participationLabel } from './PersonDialog';

const slug = (name: string, taken: Set<string>) => {
  const base =
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'person';
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const FamilyEditor: React.FC<{ adminUserId: string }> = ({ adminUserId }) => {
  const { family: saved, photoUrls, error: loadError, replace } = useFamily();
  const { words } = useCircleWords();
  const [draft, setDraft] = useState<Family | null>(null);
  const [editing, setEditing] = useState<{ person: FamilyPerson; isNew: boolean } | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [problems, setProblems] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState(false);
  const [exportPerms, setExportPerms] = useState<{
    everyone: boolean;
    users: Record<string, boolean>;
  } | null>(null);

  useEffect(() => {
    archiveApi
      .permissions()
      .then(setExportPerms)
      .catch(() => undefined);
  }, []);

  const setExport = async (next: { everyone: boolean; users: Record<string, boolean> }) => {
    setExportPerms(next);
    try {
      await archiveApi.savePermissions(next);
    } catch {
      setProblems("The archive setting didn't save. Try again.");
    }
  };

  const family = draft ?? saved;
  const dirty = draft !== null;
  const people = useMemo(
    () =>
      family
        ? Object.values(family.people).sort(
            (a, b) =>
              Number(isRemembered(a)) - Number(isRemembered(b)) || a.name.localeCompare(b.name),
          )
        : [],
    [family],
  );

  if (loadError) return <Alert severity="warning">{loadError}</Alert>;
  if (!family) return <Typography sx={{ color: 'text.secondary' }}>Loading the family…</Typography>;

  const change = (next: Family) => {
    setDraft(next);
    setSavedNote(false);
  };

  const savePerson = (person: FamilyPerson, ties: Tie[]) => {
    change({ ...family, people: { ...family.people, [person.id]: person }, ties });
    setEditing(null);
  };

  const removePerson = (id: string) => {
    const { [id]: _gone, ...rest } = family.people;
    change({
      ...family,
      people: rest,
      ties: family.ties.filter((t) => !tieTouches(t, id)),
      households: Object.fromEntries(
        Object.entries(family.households).map(([k, h]) => [
          k,
          { ...h, members: h.members.filter((m) => m !== id) },
        ]),
      ),
    });
    setEditing(null);
  };

  const save = async () => {
    setSaving(true);
    setProblems(null);
    try {
      const res = await familyApi.save(family);
      replace(res.family, res.photoUrls);
      setDraft(null);
      setSavedNote(true);
    } catch (e) {
      setProblems(
        e instanceof ApiError
          ? [e.message, e.details].filter(Boolean).join('\n')
          : 'The family did not save. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const remembered = rememberedPeople(family);
  // A joined circle's people live in the circles it joins (docs/decisions/0018).
  const here = loadCircles();
  const joined = !!here?.circles.find((c) => c.id === here.current)?.sources;

  return (
    <Box>
      {joined && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This circle joins others: its people and how they're connected come from them. Add or
          change people in those circles, and it shows here at once.
        </Alert>
      )}
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 2,
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {people.length} people · {playingPeople(family).length} playing
          {remembered.length > 0 && ` · ${remembered.length} remembered`}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button
            startIcon={<AddIcon />}
            onClick={() =>
              setEditing({
                person: { id: '', name: '', participation: 'not-playing' },
                isNew: true,
              })
            }
          >
            Add someone
          </Button>
          <Button variant="contained" disabled={!dirty || saving} onClick={save}>
            {saving ? 'Saving…' : 'Save family'}
          </Button>
        </Stack>
      </Stack>

      {savedNote && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSavedNote(false)}>
          Saved. The previous version is kept, so nothing is lost.
        </Alert>
      )}
      {problems && (
        <Alert severity="warning" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
          {problems}
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 1.25,
        }}
      >
        {people.map((p) => (
          <Card
            key={p.id}
            variant="outlined"
            sx={{ opacity: p.participation === 'paused' ? 0.75 : 1 }}
          >
            <CardActionArea onClick={() => setEditing({ person: p, isNew: false })} sx={{ p: 1.5 }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <Avatar
                  src={p.memorial?.photo ? photoUrls[p.memorial.photo] : undefined}
                  sx={{ width: 36, height: 36, fontSize: '0.8rem' }}
                >
                  {initials(p.name)}
                </Avatar>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 600 }} noWrap>
                    {p.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                    {p.memorial?.died
                      ? `${p.born?.date?.slice(0, 4) ?? ''}${p.born?.date ? ' – ' : ''}${p.memorial.died.slice(0, 4)}`
                      : (p.fullName ?? '')}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={participationLabel(p)}
                  variant={p.participation === 'playing' && !p.memorial ? 'filled' : 'outlined'}
                  color={
                    p.memorial ? 'default' : p.participation === 'playing' ? 'primary' : 'default'
                  }
                />
              </Stack>
            </CardActionArea>
          </Card>
        ))}
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 4, mb: 1 }}>
        {words.groups}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {words.groupHint}
      </Typography>
      <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {Object.values(family.households).map((h) => (
          <Chip
            key={h.id}
            label={`${h.name} · ${h.members.length}`}
            onClick={() => setHousehold(h)}
          />
        ))}
        <Chip
          icon={<AddIcon />}
          variant="outlined"
          label={`Add a ${words.group}`}
          onClick={() => setHousehold({ id: '', name: '', members: [] })}
        />
      </Stack>

      {editing && (
        <PersonDialog
          family={family}
          person={editing.person}
          isNew={editing.isNew}
          adminUserId={adminUserId}
          photoUrls={photoUrls}
          canDownload={
            exportPerms ? (exportPerms.users[editing.person.id] ?? exportPerms.everyone) : undefined
          }
          onCanDownload={
            exportPerms
              ? (on) =>
                  setExport({
                    ...exportPerms,
                    users: { ...exportPerms.users, [editing.person.id]: on },
                  })
              : undefined
          }
          onClose={() => setEditing(null)}
          onRemove={() => removePerson(editing.person.id)}
          onSave={(person, ties) =>
            savePerson(
              editing.isNew
                ? { ...person, id: slug(person.name, new Set(Object.keys(family.people))) }
                : person,
              ties,
            )
          }
        />
      )}

      {household && (
        <HouseholdDialog
          family={family}
          household={household}
          onClose={() => setHousehold(null)}
          onSave={(h) => {
            const id = h.id || slug(h.name, new Set(Object.keys(family.households)));
            change({ ...family, households: { ...family.households, [id]: { ...h, id } } });
            setHousehold(null);
          }}
          onRemove={
            household.id
              ? () => {
                  const { [household.id]: _gone, ...rest } = family.households;
                  change({ ...family, households: rest });
                  setHousehold(null);
                }
              : undefined
          }
        />
      )}
    </Box>
  );
};

const HouseholdDialog: React.FC<{
  family: Family;
  household: Household;
  onSave: (h: Household) => void;
  onRemove?: () => void;
  onClose: () => void;
}> = ({ family, household, onSave, onRemove, onClose }) => {
  const [h, setH] = useState(household);
  const { words } = useCircleWords();
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{household.id ? h.name : `Add a ${words.group}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Name"
            value={h.name}
            onChange={(e) => setH({ ...h, name: e.target.value })}
            required
          />
          <TextField
            label="Description"
            value={h.description ?? ''}
            onChange={(e) => setH({ ...h, description: e.target.value || undefined })}
            multiline
          />
          <TextField
            select
            label="Who's in it"
            value={h.members}
            onChange={(e) => {
              const v = e.target.value as unknown;
              setH({ ...h, members: typeof v === 'string' ? v.split(',') : (v as string[]) });
            }}
            slotProps={{ select: { multiple: true } }}
          >
            {Object.values(family.people).map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {onRemove && (
            <Button color="error" onClick={onRemove}>
              Remove {words.group}
            </Button>
          )}
        </Box>
        <Box>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!h.name.trim()}
            onClick={() => onSave({ ...h, name: h.name.trim() })}
          >
            Done
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
