/**
 * Admin › Settings. Built from the setting definitions (shared/src/settings.ts),
 * so a new setting shows up without touching this page. Each value says where
 * it comes from; changes collect in a draft until Save. One section shows at a
 * time, named in the URL (?section=) so a link lands on it.
 */

import {
  costOf,
  estimateMonthly,
  modelInfo,
  PRICES_AS_OF,
  type ResolvedSetting,
  type SettingValue,
} from '@family-trivia/shared';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type AdminSettings,
  useAdminSettings,
  useCheckModels,
  useSaveSettings,
} from '../../../entities/settings';
import { ApiError } from '../../../shared/api/ApiService';
import { BackupsPanel } from './BackupsPanel';
import { AppearanceSection, ArchiveSection } from './OtherSections';

const SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'ai', label: 'AI and cost' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'archive', label: 'Archive' },
  { id: 'backups', label: 'Backups' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];

const SOURCE: Record<ResolvedSetting['source'], { label: string; hint: string }> = {
  stored: { label: 'Saved', hint: 'Saved for your family. Overrides the default.' },
  env: {
    label: 'From deployment',
    hint: 'Set where the app is deployed. Save a value here to override it.',
  },
  default: { label: 'Default', hint: 'Nothing saved; the built-in default applies.' },
};

const SourceBadge: React.FC<{ source: ResolvedSetting['source']; pending?: boolean }> = ({
  source,
  pending,
}) => (
  <Tooltip title={pending ? 'Changed, not saved yet' : SOURCE[source].hint} arrow>
    <Chip
      size="small"
      label={pending ? 'Unsaved' : SOURCE[source].label}
      color={pending ? 'warning' : source === 'stored' ? 'primary' : 'default'}
      variant={pending || source === 'stored' ? 'filled' : 'outlined'}
      sx={{ fontWeight: 600, height: 22 }}
    />
  </Tooltip>
);

const money = (n: number) => (n < 0.01 && n > 0 ? '< $0.01' : `$${n.toFixed(2)}`);

export const SettingsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const section = (SECTIONS.find((s) => s.id === params.get('section'))?.id ??
    'features') as SectionId;
  const read = useAdminSettings();
  const saving = useSaveSettings();
  const data = read.data ?? null;
  const [draft, setDraft] = useState<Record<string, SettingValue>>({});
  const busy = saving.isPending;
  const [message, setMessage] = useState<{ tone: 'success' | 'warning'; text: string } | null>(
    null,
  );
  const [loadNoticeClosed, setLoadNoticeClosed] = useState(false);
  const notice =
    message ??
    (read.isError && !data && !loadNoticeClosed
      ? { tone: 'warning' as const, text: "Settings didn't load. Try again in a moment." }
      : null);

  const value = (s: ResolvedSetting) => (s.key in draft ? draft[s.key] : s.value);
  const dirty = Object.keys(draft).length > 0;

  const save = () => {
    setMessage(null);
    saving.mutate(draft, {
      onSuccess: () => {
        setDraft({});
        setMessage({ tone: 'success', text: 'Saved.' });
      },
      onError: (e) =>
        setMessage({
          tone: 'warning',
          text:
            e instanceof ApiError
              ? [e.message, e.details].filter(Boolean).join('\n')
              : "Settings didn't save.",
        }),
    });
  };

  return (
    <Box>
      <Tabs
        value={section}
        onChange={(_, v: SectionId) =>
          setParams(
            (p) => {
              p.set('section', v);
              return p;
            },
            { replace: true },
          )
        }
        variant="scrollable"
        sx={{ mb: 2 }}
      >
        {SECTIONS.map((s) => (
          <Tab key={s.id} value={s.id} label={s.label} />
        ))}
      </Tabs>

      {notice && (
        <Alert
          severity={notice.tone}
          sx={{ mb: 2, whiteSpace: 'pre-line' }}
          onClose={() => (message ? setMessage(null) : setLoadNoticeClosed(true))}
        >
          {notice.text}
        </Alert>
      )}

      {!data && !notice && !read.isError && (
        <Typography sx={{ color: 'text.secondary' }}>Loading settings…</Typography>
      )}

      {data && (section === 'features' || section === 'backups') && (
        <Stack spacing={1.5}>
          {data.settings
            .filter((s) => s.section === section)
            .map((s) => (
              <Paper key={s.key} variant="outlined" sx={{ p: 2 }}>
                <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                  <FormControlLabel
                    sx={{ flex: 1, m: 0 }}
                    control={
                      <Switch
                        checked={value(s) === true}
                        onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))}
                      />
                    }
                    label={<Typography sx={{ fontWeight: 600 }}>{s.label}</Typography>}
                  />
                  <SourceBadge source={s.source} pending={s.key in draft} />
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, ml: 6 }}>
                  {s.help}
                </Typography>
              </Paper>
            ))}
        </Stack>
      )}

      {data && section === 'ai' && <AiSection data={data} draft={draft} setDraft={setDraft} />}
      {section === 'appearance' && <AppearanceSection />}
      {section === 'archive' && <ArchiveSection />}
      {section === 'backups' && (
        <Box sx={{ mt: 1.5 }}>
          <BackupsPanel />
        </Box>
      )}

      {dirty && (
        <Paper
          elevation={6}
          sx={{
            position: 'sticky',
            bottom: 16,
            mt: 3,
            p: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            justifyContent: 'flex-end',
          }}
        >
          <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
            {Object.keys(draft).length} unsaved{' '}
            {Object.keys(draft).length === 1 ? 'change' : 'changes'}
          </Typography>
          <Button onClick={() => setDraft({})} disabled={busy}>
            Discard
          </Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            Save
          </Button>
        </Paper>
      )}
    </Box>
  );
};

const AiSection: React.FC<{
  data: AdminSettings;
  draft: Record<string, SettingValue>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, SettingValue>>>;
}> = ({ data, draft, setDraft }) => {
  // The answer is the whole view, models checked: it replaces the cached one.
  const checkModels = useCheckModels();
  const checking = checkModels.isPending;
  const setting = (taskId: string) => data.settings.find((s) => s.key === `ai.model.${taskId}`);

  const rows = useMemo(
    () =>
      data.tasks.map((t) => {
        const key = `ai.model.${t.id}`;
        const chosen =
          key in draft ? (draft[key] as string | null) : (setting(t.id)?.value as string | null);
        const fallback = t.role === 'fast' ? data.defaults.fast : data.defaults.writer;
        const effective = chosen || fallback;
        const used = Object.entries(data.usage.thisMonth[t.id] ?? {});
        const spent = used.reduce(
          (sum, [m, u]) => sum + costOf(modelInfo(m), u.input, u.output),
          0,
        );
        const calls = used.reduce((sum, [, u]) => sum + u.calls, 0);
        return {
          task: t,
          key,
          chosen,
          effective,
          estimate: estimateMonthly(t, modelInfo(effective), data.players),
          spent,
          calls,
        };
      }),
    [data, draft],
  );

  const totalEstimate = rows.reduce((s, r) => s + r.estimate, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const label = (id: string) => modelInfo(id)?.label ?? id;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ gap: 3, alignItems: { sm: 'center' } }}
        >
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              This month so far
            </Typography>
            <Typography variant="h3">{money(totalSpent)}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Estimated per month, {data.players} {data.players === 1 ? 'player' : 'players'},
              during a season
            </Typography>
            <Typography variant="h3">{money(totalEstimate)}</Typography>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button
            startIcon={<RefreshIcon />}
            disabled={checking}
            onClick={() => checkModels.mutate()}
          >
            {checking ? 'Checking…' : 'Check which models work'}
          </Button>
        </Stack>
        {checkModels.isError && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            The models weren't checked. Try again in a moment.
          </Alert>
        )}
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mt: 1 }}>
          Spend is counted from the tokens each call actually used, at Bedrock list prices (
          {PRICES_AS_OF}); your AWS bill is the final word. Models last checked{' '}
          {new Date(data.availabilityCheckedAt).toLocaleString()}.
        </Typography>
      </Paper>

      {rows.map((r) => (
        <Paper key={r.task.id} variant="outlined" sx={{ p: 2 }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            sx={{ gap: 2, alignItems: { md: 'center' } }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
                <Typography sx={{ fontWeight: 600 }}>{r.task.label}</Typography>
                {(() => {
                  const s = setting(r.task.id);
                  return s && <SourceBadge source={s.source} pending={r.key in draft} />;
                })()}
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {r.task.description}
              </Typography>
            </Box>
            <TextField
              select
              size="small"
              label="Model"
              value={r.chosen ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [r.key]: e.target.value || null }))}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              sx={{ minWidth: 240 }}
            >
              <MenuItem value="">
                Default ({label(r.task.role === 'fast' ? data.defaults.fast : data.defaults.writer)}
                )
              </MenuItem>
              {data.models.map((m) => (
                <MenuItem key={m.id} value={m.id} disabled={m.availability?.ok === false}>
                  <Box>
                    <Typography sx={{ fontSize: '0.9rem' }}>
                      {m.label} · ${m.price.input}/${m.price.output}
                    </Typography>
                    {m.availability?.ok === false && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        {m.availability.reason}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ minWidth: 150, textAlign: { md: 'right' } }}>
              <Typography sx={{ fontWeight: 600 }}>{money(r.estimate)}/mo est.</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {r.calls
                  ? `${money(r.spent)} this month · ${r.calls} calls`
                  : 'not used yet this month'}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Stack>
  );
};
