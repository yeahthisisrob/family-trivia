/** Settings sections stored with their own features: the family theme and the archive. */
import CheckIcon from '@mui/icons-material/Check';
import {
  Alert,
  Box,
  ButtonBase,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useEffect, useState } from 'react';
import { appearanceApi } from '../../../entities/appearance';
import { DEFAULT_THEME_ID, THEMES, useAppearance } from '../../../shared/design-system';
import { archiveApi } from '../../family-archive';

export const AppearanceSection: React.FC = () => {
  const a = useAppearance();
  const [saving, setSaving] = useState<string | null>(null);
  const choose = async (id: string) => {
    setSaving(id);
    try {
      await appearanceApi.setFamilyTheme(id);
      a.setFamilyTheme(id);
    } finally {
      setSaving(null);
    }
  };
  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        The theme everyone sees unless they pick their own in the Appearance menu.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 1.5,
        }}
      >
        {THEMES.map((t) => {
          const s = t.schemes[a.resolved];
          const on = a.familyThemeId === t.id || (!a.familyThemeId && t.id === DEFAULT_THEME_ID);
          return (
            <ButtonBase
              key={t.id}
              onClick={() => choose(t.id)}
              disabled={saving !== null}
              sx={{
                display: 'block',
                textAlign: 'left',
                borderRadius: 2,
                border: 2,
                borderColor: on ? 'primary.main' : 'divider',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ height: 14, background: s.header }} />
              <Box sx={{ p: 1.5, bgcolor: s.background.default }}>
                <Stack direction="row" sx={{ gap: 0.75, mb: 1 }}>
                  {[s.primary.main, s.secondary.main, s.background.paper].map((c) => (
                    <Box
                      key={c}
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        bgcolor: c,
                        border: `1px solid ${s.divider}`,
                      }}
                    />
                  ))}
                </Stack>
                <Typography sx={{ fontWeight: 600, color: s.text.primary }}>
                  {t.name} {on && <CheckIcon sx={{ fontSize: 16, verticalAlign: 'middle' }} />}
                </Typography>
                <Typography sx={{ fontSize: '0.78rem', color: s.text.secondary }}>
                  {t.description}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
};

export const ArchiveSection: React.FC = () => {
  const [perms, setPerms] = useState<{ everyone: boolean; users: Record<string, boolean> } | null>(
    null,
  );
  const [error, setError] = useState(false);
  useEffect(() => {
    archiveApi
      .permissions()
      .then(setPerms)
      .catch(() => setError(true));
  }, []);
  if (error) return <Alert severity="warning">The archive setting didn't load.</Alert>;
  if (!perms) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={perms.everyone}
            onChange={async (e) => {
              const next = { ...perms, everyone: e.target.checked };
              setPerms(next);
              await archiveApi.savePermissions(next);
            }}
          />
        }
        label={
          <Typography sx={{ fontWeight: 600 }}>Everyone can download the family archive</Typography>
        }
      />
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5, ml: 6 }}>
        A zip of everyone's answers, facts, games and comments, one folder per person. Admins can
        always download it; allow or block one person in Admin › Family.
      </Typography>
    </Paper>
  );
};
