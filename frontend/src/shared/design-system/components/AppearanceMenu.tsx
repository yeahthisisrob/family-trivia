/**
 * The Appearance menu: light, dark or follow the device, and the theme, each
 * shown as a small live preview. Admins can make the theme they're looking at
 * the family's default.
 */
import CheckIcon from '@mui/icons-material/Check';
import PaletteOutlinedIcon from '@mui/icons-material/PaletteOutlined';
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Popover,
  Stack,
  type SxProps,
  type Theme,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import type { ThemeDefinition } from '../themes/types';
import { type ColorMode, useAppearance } from './AppearanceProvider';

/** A tiny card painted in the theme's own colors. */
const Swatch: React.FC<{ def: ThemeDefinition; mode: 'light' | 'dark' }> = ({ def, mode }) => {
  const t = def.schemes[mode];
  return (
    <Box
      aria-hidden
      sx={{
        width: 64,
        height: 44,
        borderRadius: 1,
        overflow: 'hidden',
        border: `1px solid ${t.divider}`,
        bgcolor: t.background.default,
        flexShrink: 0,
      }}
    >
      <Box sx={{ height: 10, background: t.header }} />
      <Box
        sx={{
          m: 0.75,
          p: 0.5,
          borderRadius: 0.5,
          bgcolor: t.background.paper,
          display: 'flex',
          gap: 0.5,
        }}
      >
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.primary.main }} />
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.secondary.main }} />
      </Box>
    </Box>
  );
};

interface AppearanceMenuProps {
  sx?: SxProps<Theme>;
  /** Shown to admins: save the current theme as the family's default. */
  onSetFamilyDefault?: (themeId: string) => Promise<void>;
}

export const AppearanceMenu: React.FC<AppearanceMenuProps> = ({ sx, onSetFamilyDefault }) => {
  const a = useAppearance();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <>
      <Tooltip title="Appearance">
        <IconButton
          size="small"
          aria-label="Appearance"
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={sx}
        >
          <PaletteOutlinedIcon sx={{ fontSize: 19 }} />
        </IconButton>
      </Tooltip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { width: 320, p: 2 } } }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Light or dark
        </Typography>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={a.mode}
          onChange={(_, m: ColorMode | null) => m && a.setMode(m)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="light">Light</ToggleButton>
          <ToggleButton value="system">Auto</ToggleButton>
          <ToggleButton value="dark">Dark</ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Theme
        </Typography>
        <Stack spacing={0.5} role="listbox" aria-label="Theme">
          {a.themes.map((def) => {
            const selected = a.theme.id === def.id;
            return (
              <ButtonBase
                key={def.id}
                role="option"
                aria-selected={selected}
                onClick={() => a.setTheme(def.id)}
                sx={{
                  justifyContent: 'flex-start',
                  textAlign: 'left',
                  gap: 1.5,
                  p: 1,
                  borderRadius: 1,
                  border: 1,
                  borderColor: selected ? 'primary.main' : 'transparent',
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                <Swatch def={def} mode={a.resolved} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    {def.name}
                    {a.familyThemeId === def.id && (
                      <Typography
                        component="span"
                        sx={{ ml: 0.75, fontSize: '0.7rem', color: 'text.secondary' }}
                      >
                        family default
                      </Typography>
                    )}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                    {def.description}
                  </Typography>
                </Box>
                {selected && <CheckIcon fontSize="small" color="primary" />}
              </ButtonBase>
            );
          })}
        </Stack>

        <Stack
          direction="row"
          sx={{ mt: 1.5, justifyContent: 'space-between', alignItems: 'center' }}
        >
          {a.chosenThemeId && a.familyThemeId && a.chosenThemeId !== a.familyThemeId ? (
            <Button size="small" onClick={() => a.setTheme(null)}>
              Use the family's theme
            </Button>
          ) : (
            <span />
          )}
          {onSetFamilyDefault && a.familyThemeId !== a.theme.id && (
            <Button
              size="small"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await onSetFamilyDefault(a.theme.id);
                  a.setFamilyTheme(a.theme.id);
                } finally {
                  setSaving(false);
                }
              }}
            >
              Make {a.theme.name} the family default
            </Button>
          )}
        </Stack>
      </Popover>
    </>
  );
};
