// File: frontend/src/components/SetupWizard/SetupWizard.tsx
// First-time setup wizard using MUI Stepper. Calls existing admin API endpoints.

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Paper,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import React, { useState, useCallback } from 'react';

import * as adminApi from '../../api/modules/admin';
import { importQuestions } from '../../api/modules/triviaBank';
import { createLogger } from '../../utils/logger';

const logger = createLogger('SetupWizard');

// ── Types ───────────────────────────────────────────────────────

interface SetupWizardProps {
  onComplete: () => void;
}

interface FamilySide {
  id: string;
  name: string;
  color: string;
}

interface GroupDraft {
  groupId: string;
  name: string;
  description: string;
  side: string;
}

interface MemberDraft {
  userId: string;
  group: string;
  color: string;
  passphrase: string;
  isAdmin: boolean;
}

// ── Word lists for passphrase generation ────────────────────────

const ADJECTIVES = [
  'happy', 'brave', 'clever', 'gentle', 'swift', 'bright', 'calm',
  'eager', 'fancy', 'golden', 'jolly', 'keen', 'lucky', 'merry',
  'noble', 'proud', 'quiet', 'royal', 'sunny', 'vivid', 'warm',
  'witty', 'bold', 'cozy', 'daring', 'fierce', 'grand', 'humble',
];

const NOUNS = [
  'tiger', 'river', 'mountain', 'garden', 'falcon', 'ocean',
  'forest', 'castle', 'meadow', 'sunset', 'dragon', 'crystal',
  'thunder', 'phoenix', 'harbor', 'village', 'island', 'canyon',
  'dolphin', 'panther', 'sparrow', 'willow', 'breeze', 'comet',
  'glacier', 'pebble', 'lantern', 'orchid', 'raven', 'tulip',
];

function generatePassphrase(): string {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${pick(ADJECTIVES)}`;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Step components ─────────────────────────────────────────────

const STEP_LABELS = [
  'Welcome',
  'Family Sides',
  'Groups',
  'Members',
  'Season',
  'Import Questions',
  'Done!',
];

// Step 0: Welcome
const WelcomeStep: React.FC<{ onNext: () => void }> = ({ onNext }) => (
  <Box sx={{ textAlign: 'center', py: 4 }}>
    <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
      Welcome to Family Trivia!
    </Typography>
    <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
      Let&apos;s set up your family in a few quick steps
    </Typography>
    <Button variant="contained" color="success" size="large" onClick={onNext}>
      Get Started
    </Button>
  </Box>
);

// Step 1: Family Sides
interface FamilySidesStepProps {
  sides: [FamilySide, FamilySide];
  setSides: React.Dispatch<React.SetStateAction<[FamilySide, FamilySide]>>;
  rootPartner1: string;
  setRootPartner1: (v: string) => void;
  rootPartner2: string;
  setRootPartner2: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  error: string | null;
}

const FamilySidesStep: React.FC<FamilySidesStepProps> = ({
  sides, setSides,
  rootPartner1, setRootPartner1,
  rootPartner2, setRootPartner2,
  onNext, onBack, saving, error,
}) => {
  const updateSide = (index: 0 | 1, field: keyof FamilySide, value: string) => {
    setSides(prev => {
      const next = [...prev] as [FamilySide, FamilySide];
      next[index] = { ...next[index], [field]: value };
      if (field === 'name') {
        next[index].id = toSlug(value);
      }
      return next;
    });
  };

  const canProceed = sides[0].name.trim() && sides[1].name.trim()
    && rootPartner1.trim() && rootPartner2.trim();

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Create your two family sides</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These represent each partner&apos;s side of the family (e.g. &quot;Smith Side&quot; and &quot;Jones Side&quot;).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Typography variant="subtitle2" sx={{ mb: 1 }}>Root Couple</Typography>
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          label="Partner 1 Name"
          value={rootPartner1}
          onChange={e => setRootPartner1(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 180 }}
        />
        <TextField
          label="Partner 2 Name"
          value={rootPartner2}
          onChange={e => setRootPartner2(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 180 }}
        />
      </Box>

      {[0, 1].map(i => (
        <Box key={i} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Side {i + 1}</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Side Name"
              value={sides[i as 0 | 1].name}
              onChange={e => updateSide(i as 0 | 1, 'name', e.target.value)}
              size="small"
              sx={{ flex: 1, minWidth: 180 }}
            />
            <TextField
              label="Color"
              type="color"
              value={sides[i as 0 | 1].color}
              onChange={e => updateSide(i as 0 | 1, 'color', e.target.value)}
              size="small"
              sx={{ width: 80 }}
              InputProps={{ sx: { height: 40 } }}
            />
          </Box>
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={onNext} disabled={!canProceed || saving}>
          {saving ? 'Saving...' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

// Step 2: Groups
interface GroupsStepProps {
  groups: GroupDraft[];
  setGroups: React.Dispatch<React.SetStateAction<GroupDraft[]>>;
  sides: [FamilySide, FamilySide];
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  error: string | null;
}

const GroupsStep: React.FC<GroupsStepProps> = ({
  groups, setGroups, sides, onNext, onBack, saving, error,
}) => {
  const [form, setForm] = useState<GroupDraft>({ groupId: '', name: '', description: '', side: sides[0]?.id || '' });

  const addGroup = () => {
    if (!form.name.trim()) return;
    const groupId = toSlug(form.name);
    if (groups.some(g => g.groupId === groupId)) return;
    setGroups(prev => [...prev, { ...form, groupId }]);
    setForm({ groupId: '', name: '', description: '', side: form.side });
  };

  const removeGroup = (groupId: string) => {
    setGroups(prev => prev.filter(g => g.groupId !== groupId));
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Create groups</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Groups organize members within each side (e.g. &quot;Kids&quot;, &quot;Grandkids&quot;, &quot;Aunts &amp; Uncles&quot;).
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          label="Group Name"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          size="small"
          sx={{ flex: 1, minWidth: 150 }}
        />
        <TextField
          label="Description (optional)"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          size="small"
          sx={{ flex: 1, minWidth: 150 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Side</InputLabel>
          <Select
            label="Side"
            value={form.side}
            onChange={e => setForm(f => ({ ...f, side: e.target.value }))}
          >
            {sides.map(s => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="outlined" onClick={addGroup} disabled={!form.name.trim()}>
          Add
        </Button>
      </Box>

      {groups.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Group</TableCell>
                <TableCell>Side</TableCell>
                <TableCell>Description</TableCell>
                <TableCell width={50} />
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map(g => (
                <TableRow key={g.groupId}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>{sides.find(s => s.id === g.side)?.name || g.side}</TableCell>
                  <TableCell>{g.description || '--'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeGroup(g.groupId)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Back</Button>
        <Button variant="contained" onClick={onNext} disabled={groups.length === 0 || saving}>
          {saving ? 'Saving...' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

// Step 3: Members
interface MembersStepProps {
  members: MemberDraft[];
  setMembers: React.Dispatch<React.SetStateAction<MemberDraft[]>>;
  groups: GroupDraft[];
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  error: string | null;
}

const EMPTY_MEMBER: MemberDraft = {
  userId: '', group: '', color: '#4CAF50', passphrase: '', isAdmin: false,
};

const MembersStep: React.FC<MembersStepProps> = ({
  members, setMembers, groups, onNext, onBack, saving, error,
}) => {
  const [form, setForm] = useState<MemberDraft>({
    ...EMPTY_MEMBER,
    group: groups[0]?.groupId || '',
    passphrase: generatePassphrase(),
  });

  const addMember = () => {
    if (!form.userId.trim() || !form.group) return;
    const userId = toSlug(form.userId);
    if (members.some(m => m.userId === userId)) return;
    setMembers(prev => [...prev, { ...form, userId }]);
    setForm({
      ...EMPTY_MEMBER,
      group: form.group,
      passphrase: generatePassphrase(),
    });
  };

  const removeMember = (userId: string) => {
    setMembers(prev => prev.filter(m => m.userId !== userId));
  };

  const hasAdmin = members.some(m => m.isAdmin);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Add family members</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Each member needs a name, group, and passphrase. Mark at least one person as admin.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!hasAdmin && members.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No admin selected. At least one member must be an admin.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField
          label="Name"
          value={form.userId}
          onChange={e => setForm(f => ({ ...f, userId: e.target.value }))}
          size="small"
          placeholder="e.g. uncle-buddy"
          sx={{ flex: 1, minWidth: 140 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Group</InputLabel>
          <Select
            label="Group"
            value={form.group}
            onChange={e => setForm(f => ({ ...f, group: e.target.value }))}
          >
            {groups.map(g => (
              <MenuItem key={g.groupId} value={g.groupId}>{g.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          label="Color"
          type="color"
          value={form.color}
          onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
          size="small"
          sx={{ width: 80 }}
          InputProps={{ sx: { height: 40 } }}
        />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Passphrase"
          value={form.passphrase}
          onChange={e => setForm(f => ({ ...f, passphrase: e.target.value }))}
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
        />
        <Button
          variant="outlined"
          size="small"
          onClick={() => setForm(f => ({ ...f, passphrase: generatePassphrase() }))}
        >
          Generate
        </Button>
        <FormControlLabel
          control={
            <Checkbox
              checked={form.isAdmin}
              onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
              size="small"
            />
          }
          label="Admin"
        />
        <Button variant="outlined" onClick={addMember} disabled={!form.userId.trim() || !form.group}>
          Add
        </Button>
      </Box>

      {members.length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Group</TableCell>
                <TableCell>Passphrase</TableCell>
                <TableCell>Role</TableCell>
                <TableCell width={50} />
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map(m => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: m.color, flexShrink: 0 }} />
                      {m.userId}
                    </Box>
                  </TableCell>
                  <TableCell>{groups.find(g => g.groupId === m.group)?.name || m.group}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{m.passphrase}</TableCell>
                  <TableCell>{m.isAdmin ? <Chip label="Admin" size="small" color="primary" /> : 'Member'}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={() => removeMember(m.userId)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onBack}>Back</Button>
        <Button
          variant="contained"
          onClick={onNext}
          disabled={members.length === 0 || !hasAdmin || saving}
        >
          {saving ? 'Saving...' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

// Step 4: Season
interface SeasonStepProps {
  seasonName: string;
  setSeasonName: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
  saving: boolean;
  error: string | null;
}

const SeasonStep: React.FC<SeasonStepProps> = ({
  seasonName, setSeasonName, startDate, setStartDate,
  onNext, onBack, saving, error,
}) => (
  <Box>
    <Typography variant="h6" sx={{ mb: 2 }}>Create your first season</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
      Seasons organize trivia into time periods. You can create more later.
    </Typography>

    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

    <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
      <TextField
        label="Season Name"
        value={seasonName}
        onChange={e => setSeasonName(e.target.value)}
        size="small"
        placeholder="e.g. Season 1"
        sx={{ flex: 1, minWidth: 200 }}
      />
      <TextField
        label="Start Date"
        type="date"
        value={startDate}
        onChange={e => setStartDate(e.target.value)}
        size="small"
        sx={{ width: 180 }}
        InputLabelProps={{ shrink: true }}
      />
    </Box>

    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
      <Button onClick={onBack}>Back</Button>
      <Button
        variant="contained"
        onClick={onNext}
        disabled={!seasonName.trim() || !startDate || saving}
      >
        {saving ? 'Saving...' : 'Next'}
      </Button>
    </Box>
  </Box>
);

// Step 5: Import Questions
interface ImportStepProps {
  onNext: () => void;
  onBack: () => void;
  adminUserId: string;
}

const OPENTDB_CATEGORIES = [
  { id: 'General Knowledge', label: 'General Knowledge' },
  { id: 'Science', label: 'Science' },
  { id: 'History', label: 'History' },
  { id: 'Geography', label: 'Geography' },
  { id: 'Entertainment', label: 'Entertainment' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Art', label: 'Art' },
  { id: 'Animals', label: 'Animals' },
  { id: 'Mythology', label: 'Mythology' },
  { id: 'Music', label: 'Music' },
];

const ImportStep: React.FC<ImportStepProps> = ({ onNext, onBack, adminUserId }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set(['General Knowledge', 'Science', 'History']));
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<Array<{ category: string; added: number; error?: string }>>([]);
  const [done, setDone] = useState(false);

  const toggle = (cat: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResults([]);
    const results: typeof importResults = [];

    for (const category of selected) {
      try {
        const res = await importQuestions(adminUserId, 'opentdb', category, 'normal', 50);
        results.push({ category, added: res.added });
      } catch (err) {
        logger.error(`Failed to import ${category}`, err);
        results.push({ category, added: 0, error: 'Failed to import' });
      }
      setImportResults([...results]);
    }

    setImporting(false);
    setDone(true);
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Import starter questions</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Import free trivia questions from OpenTDB to get started. You can always import more later from the admin panel.
      </Typography>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
        {OPENTDB_CATEGORIES.map(cat => (
          <Chip
            key={cat.id}
            label={cat.label}
            onClick={() => !importing && toggle(cat.id)}
            color={selected.has(cat.id) ? 'primary' : 'default'}
            variant={selected.has(cat.id) ? 'filled' : 'outlined'}
            sx={{ cursor: importing ? 'default' : 'pointer' }}
          />
        ))}
      </Box>

      {importResults.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {importResults.map(r => (
            <Typography
              key={r.category}
              variant="body2"
              color={r.error ? 'error' : 'success.main'}
              sx={{ mb: 0.5 }}
            >
              {r.category}: {r.error ? r.error : `${r.added} questions imported`}
            </Typography>
          ))}
        </Box>
      )}

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
        <Button onClick={onBack} disabled={importing}>Back</Button>
        {!done ? (
          <>
            <Button onClick={onNext} disabled={importing}>
              Skip
            </Button>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
            >
              {importing ? 'Importing...' : `Import ${selected.size} categories`}
            </Button>
          </>
        ) : (
          <Button variant="contained" onClick={onNext}>
            Next
          </Button>
        )}
      </Box>
    </Box>
  );
};

// Step 6: Done
interface DoneStepProps {
  members: MemberDraft[];
  onComplete: () => void;
}

const DoneStep: React.FC<DoneStepProps> = ({ members, onComplete }) => {
  const [copied, setCopied] = useState(false);

  const passphraseText = members.map(m => `${m.userId}: ${m.passphrase}`).join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(passphraseText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      logger.warn('Clipboard copy failed');
    }
  };

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      <CheckCircleIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        You&apos;re all set!
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Share these passphrases with your family members.
        They&apos;ll sign in with Google and enter their passphrase to link their account.
      </Typography>

      <Paper variant="outlined" sx={{ maxWidth: 400, mx: 'auto', mb: 3, textAlign: 'left' }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle2">Passphrases</Typography>
            <IconButton size="small" onClick={handleCopy} title="Copy all">
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Box>
          {copied && (
            <Alert severity="success" sx={{ mb: 1, py: 0 }}>Copied to clipboard!</Alert>
          )}
          {members.map(m => (
            <Box key={m.userId} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>{m.userId}</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{m.passphrase}</Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      <Button variant="contained" color="success" size="large" onClick={onComplete}>
        Go to App
      </Button>
    </Box>
  );
};

// ── Main Wizard ─────────────────────────────────────────────────

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Family Sides state
  const [sides, setSides] = useState<[FamilySide, FamilySide]>([
    { id: '', name: '', color: '#2196F3' },
    { id: '', name: '', color: '#E91E63' },
  ]);
  const [rootPartner1, setRootPartner1] = useState('');
  const [rootPartner2, setRootPartner2] = useState('');

  // Step 2: Groups state
  const [groups, setGroups] = useState<GroupDraft[]>([]);

  // Step 3: Members state
  const [members, setMembers] = useState<MemberDraft[]>([]);

  // Step 4: Season state
  const [seasonName, setSeasonName] = useState('Season 1');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Identify the first admin for API calls
  const getAdminUserId = useCallback((): string => {
    const admin = members.find(m => m.isAdmin);
    return admin?.userId || members[0]?.userId || 'setup-admin';
  }, [members]);

  // ── Step transition handlers ────────────────────────────────

  const saveFamilySides = async () => {
    setError(null);
    setSaving(true);
    try {
      const adminId = getAdminUserId();
      const sidesData: Record<string, adminApi.SideConfig> = {};
      for (const s of sides) {
        sidesData[s.id] = {
          id: s.id,
          name: s.name,
          color: s.color,
          groups: [],
        };
      }
      const rootPartners = [
        { id: toSlug(rootPartner1), name: rootPartner1 },
        { id: toSlug(rootPartner2), name: rootPartner2 },
      ];
      await adminApi.updateFamilyTree(adminId, { rootPartners, sides: sidesData });
      setActiveStep(2);
    } catch (err) {
      logger.error('Failed to save family sides', err);
      setError(err instanceof Error ? err.message : 'Failed to save family sides');
    } finally {
      setSaving(false);
    }
  };

  const saveGroups = async () => {
    setError(null);
    setSaving(true);
    try {
      const adminId = getAdminUserId();
      for (const g of groups) {
        await adminApi.addGroup(adminId, {
          groupId: g.groupId,
          name: g.name,
          description: g.description || undefined,
          side: g.side || undefined,
        });
      }
      setActiveStep(3);
    } catch (err) {
      logger.error('Failed to save groups', err);
      setError(err instanceof Error ? err.message : 'Failed to save groups');
    } finally {
      setSaving(false);
    }
  };

  const saveMembers = async () => {
    setError(null);
    setSaving(true);
    try {
      const adminId = getAdminUserId();
      for (const m of members) {
        await adminApi.addPlayer(adminId, {
          userId: m.userId,
          group: m.group,
          color: m.color,
          passphrase: m.passphrase,
          isAdmin: m.isAdmin,
        });
      }
      setActiveStep(4);
    } catch (err) {
      logger.error('Failed to save members', err);
      setError(err instanceof Error ? err.message : 'Failed to save members');
    } finally {
      setSaving(false);
    }
  };

  const saveSeason = async () => {
    setError(null);
    setSaving(true);
    try {
      const adminId = getAdminUserId();
      await adminApi.addSeason(adminId, {
        seasonNumber: 1,
        name: seasonName,
        startDate,
        status: 'active',
      });
      setActiveStep(5);
    } catch (err) {
      logger.error('Failed to save season', err);
      setError(err instanceof Error ? err.message : 'Failed to save season');
    } finally {
      setSaving(false);
    }
  };

  // ── Render step content ────────────────────────────────────

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return <WelcomeStep onNext={() => setActiveStep(1)} />;
      case 1:
        return (
          <FamilySidesStep
            sides={sides}
            setSides={setSides}
            rootPartner1={rootPartner1}
            setRootPartner1={setRootPartner1}
            rootPartner2={rootPartner2}
            setRootPartner2={setRootPartner2}
            onNext={saveFamilySides}
            onBack={() => setActiveStep(0)}
            saving={saving}
            error={error}
          />
        );
      case 2:
        return (
          <GroupsStep
            groups={groups}
            setGroups={setGroups}
            sides={sides}
            onNext={saveGroups}
            onBack={() => setActiveStep(1)}
            saving={saving}
            error={error}
          />
        );
      case 3:
        return (
          <MembersStep
            members={members}
            setMembers={setMembers}
            groups={groups}
            onNext={saveMembers}
            onBack={() => setActiveStep(2)}
            saving={saving}
            error={error}
          />
        );
      case 4:
        return (
          <SeasonStep
            seasonName={seasonName}
            setSeasonName={setSeasonName}
            startDate={startDate}
            setStartDate={setStartDate}
            onNext={saveSeason}
            onBack={() => setActiveStep(3)}
            saving={saving}
            error={error}
          />
        );
      case 5:
        return (
          <ImportStep
            onNext={() => setActiveStep(6)}
            onBack={() => setActiveStep(4)}
            adminUserId={getAdminUserId()}
          />
        );
      case 6:
        return <DoneStep members={members} onComplete={onComplete} />;
      default:
        return null;
    }
  };

  // ── Layout ────────────────────────────────────────────────

  return (
    <Box sx={{
      maxWidth: 600,
      mx: 'auto',
      px: 2,
      py: 4,
      minHeight: '100vh',
    }}>
      <Stepper
        activeStep={activeStep}
        orientation={isMobile ? 'vertical' : 'horizontal'}
        sx={{ mb: isMobile ? 0 : 4 }}
      >
        {STEP_LABELS.map((label, index) => (
          <Step key={label} completed={index < activeStep}>
            <StepLabel>{isMobile || index === activeStep ? label : ''}</StepLabel>
            {isMobile && (
              <StepContent>
                {index === activeStep && renderStepContent(index)}
              </StepContent>
            )}
          </Step>
        ))}
      </Stepper>

      {!isMobile && renderStepContent(activeStep)}
    </Box>
  );
};

export default SetupWizard;
