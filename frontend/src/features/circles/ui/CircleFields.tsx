/**
 * What a new circle needs (docs/decisions/0015): a name, who's in it, how it
 * looks, and what it calls you. Starting any circle, the first one included,
 * is this one form.
 */
import type { CircleKind } from '@family-trivia/shared';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { Box, ButtonBase, Stack, TextField, Typography } from '@mui/material';
import type React from 'react';
import { CIRCLE_KINDS, KIND_ICON, KIND_LABEL, KIND_LINE } from '../../../entities/circle';
import { DEFAULT_THEME_ID, THEMES } from '../../../shared/design-system';

export interface NewCircle {
  name: string;
  kind: CircleKind;
  themeId: string;
  yourName: string;
}

export const newCircle = (yourName = '', kind: CircleKind = 'friends'): NewCircle => ({
  name: '',
  kind,
  themeId: DEFAULT_THEME_ID,
  yourName,
});

export const isReady = (c: NewCircle) => !!c.name.trim() && !!c.yourName.trim();

export const CircleFields: React.FC<{ value: NewCircle; onChange: (c: NewCircle) => void }> = ({
  value,
  onChange,
}) => {
  const set = (patch: Partial<NewCircle>) => onChange({ ...value, ...patch });
  return (
    <Stack spacing={2.5}>
      <TextField
        autoFocus
        fullWidth
        label="Name"
        placeholder="The Crew"
        value={value.name}
        onChange={(e) => set({ name: e.target.value })}
      />

      <Box>
        <Label>Who's in it</Label>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
          {CIRCLE_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <Choice key={k} selected={value.kind === k} onClick={() => set({ kind: k })}>
                <Icon />
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mt: 0.5 }}>
                  {KIND_LABEL[k]}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                  {KIND_LINE[k]}
                </Typography>
              </Choice>
            );
          })}
        </Box>
      </Box>

      <Box>
        <Label>How it looks</Label>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: 1,
          }}
        >
          {THEMES.map((t) => (
            <Choice
              key={t.id}
              selected={value.themeId === t.id}
              onClick={() => set({ themeId: t.id })}
            >
              <Box
                sx={{
                  height: 28,
                  borderRadius: 1,
                  background: t.schemes.light.header,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'flex-end',
                  p: 0.5,
                }}
              >
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: t.schemes.light.secondary.main,
                  }}
                />
              </Box>
              <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', mt: 0.75 }}>
                {t.name}
              </Typography>
            </Choice>
          ))}
        </Box>
      </Box>

      <TextField
        fullWidth
        label="What this circle calls you"
        value={value.yourName}
        onChange={(e) => set({ yourName: e.target.value })}
      />
    </Stack>
  );
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: 'text.secondary', mb: 0.75 }}>
    {children}
  </Typography>
);

const Choice: React.FC<{ selected: boolean; onClick: () => void; children: React.ReactNode }> = ({
  selected,
  onClick,
  children,
}) => (
  <ButtonBase
    onClick={onClick}
    aria-pressed={selected}
    sx={{
      position: 'relative',
      display: 'block',
      textAlign: 'left',
      p: 1.25,
      borderRadius: 2,
      border: 2,
      borderColor: selected ? 'primary.main' : 'divider',
      bgcolor: selected ? 'action.selected' : 'transparent',
      transition: 'border-color 0.15s, background-color 0.15s',
    }}
  >
    {selected && (
      <CheckCircleRoundedIcon
        sx={{ position: 'absolute', top: 6, right: 6, fontSize: 18, color: 'primary.main' }}
      />
    )}
    {children}
  </ButtonBase>
);
