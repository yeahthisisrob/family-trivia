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
import { useSaveFamilyTheme } from '../../../entities/appearance';
import { DEFAULT_THEME_ID, THEMES, useAppearance } from '../../../shared/design-system';
import { useArchivePermissions, useSaveArchivePermissions } from '../../family-archive';

export const AppearanceSection: React.FC = () => {
  const a = useAppearance();
  const saving = useSaveFamilyTheme();
  const choose = (id: string) => saving.mutate(id, { onSuccess: () => a.setFamilyTheme(id) });
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
              disabled={saving.isPending}
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
  const read = useArchivePermissions();
  const saving = useSaveArchivePermissions();
  const perms = read.data;
  if (read.isError && !perms)
    return <Alert severity="warning">The archive setting didn't load.</Alert>;
  if (!perms) return null;
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={perms.everyone}
            onChange={(e) => saving.mutate({ ...perms, everyone: e.target.checked })}
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
      {saving.isError && (
        <Alert severity="warning" sx={{ mt: 1.5 }}>
          The archive setting didn't save. Try again.
        </Alert>
      )}
    </Paper>
  );
};
