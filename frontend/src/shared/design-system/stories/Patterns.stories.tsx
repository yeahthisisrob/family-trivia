// Button + chip + card patterns as they're used across the app.
// Lives in "Design System/Patterns" so designers can reference
// the canonical visual treatment for each use-case.

import CasinoIcon from '@mui/icons-material/Casino';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import SaveIcon from '@mui/icons-material/Save';
import { Box, Button, Chip, IconButton, Stack, Typography, alpha, useTheme } from '@mui/material';
import React from 'react';

import { colors } from '../tokens/colors';
import { radii } from '../tokens/radii';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Patterns',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Canonical patterns for buttons, chips, and interactive elements across the app. Reference these before introducing new variations.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const Section: React.FC<{ title: string; desc?: string; children: React.ReactNode }> = ({ title, desc, children }) => (
  <Box sx={{ mb: 3 }}>
    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', mb: 0.25 }}>{title}</Typography>
    {desc && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1 }}>{desc}</Typography>}
    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>{children}</Box>
  </Box>
);

export const Buttons: Story = {
  render: () => (
    <Stack spacing={0} sx={{ maxWidth: 600 }}>
      <Section title="Primary action" desc="Submit answer, Save, Start game">
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" color="primary" startIcon={<SaveIcon />}>Save</Button>
          <Button variant="contained" color="success">Next Question</Button>
        </Stack>
      </Section>

      <Section title="Destructive" desc="Delete, Reset, Remove">
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" color="error" size="small" startIcon={<DeleteIcon />}>Delete</Button>
          <Button variant="outlined" color="error" size="small">Reset</Button>
        </Stack>
      </Section>

      <Section title="Secondary / ghost" desc="Cancel, Close, Back">
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" size="small">Cancel</Button>
          <Button variant="text" size="small">Maybe Later</Button>
        </Stack>
      </Section>

      <Section title="Gradient game-mode" desc="Casino Rush start, Slot Machine start">
        <Button
          variant="contained"
          startIcon={<CasinoIcon />}
          sx={{
            background: `linear-gradient(45deg, #d32f2f 30%, #ed6c02 90%)`,
            borderRadius: `${radii.md}px`,
          }}
        >
          Start Casino Rush
        </Button>
      </Section>

      <Section title="Icon buttons" desc="Inline actions on list items">
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small"><EditIcon sx={{ fontSize: 16 }} /></IconButton>
          <IconButton size="small" color="error"><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
        </Stack>
      </Section>
    </Stack>
  ),
};

export const Chips: Story = {
  render: () => (
    <Stack spacing={0} sx={{ maxWidth: 600 }}>
      <Section title="Status" desc="Display a state — result, type, category">
        <Stack direction="row" spacing={0.75} flexWrap="wrap">
          <Chip label="Correct" color="success" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
          <Chip label="Wrong" color="error" size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
          <Chip label="Catchup" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
          <Chip label="Casino" size="small" variant="outlined" color="warning" sx={{ height: 20, fontSize: '0.6rem' }} />
          <Chip label="shared" size="small" color="primary" sx={{ height: 20, fontSize: '0.6rem' }} />
          <Chip label="basic" size="small" sx={{ height: 20, fontSize: '0.6rem' }} />
        </Stack>
      </Section>

      <Section title="Points / streak" desc="Trivia result badges">
        <Stack direction="row" spacing={0.75}>
          <Chip icon={<LocalFireDepartmentIcon sx={{ fontSize: '13px !important' }} />}
            label="3 streak" color="success" size="small"
            sx={{ height: 22, fontWeight: 600, fontSize: '0.68rem' }} />
          <Chip label="+2 pts" color="primary" size="small"
            sx={{ height: 22, fontWeight: 600, fontSize: '0.68rem' }} />
        </Stack>
      </Section>

      <Section title="Warning — duplicates" desc="Admin list badges">
        <Stack direction="row" spacing={0.75}>
          <Chip label="skipped" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.55rem' }} />
          <Chip label="dupe ×3" size="small" color="error" variant="outlined" sx={{ height: 20, fontSize: '0.55rem' }} />
        </Stack>
      </Section>
    </Stack>
  ),
};

export const Cards: Story = {
  render: () => {
    const Card = ({ accentColor, title, children }: { accentColor?: string; title?: string; children: React.ReactNode }) => {
      const theme = useTheme();
      return (
        <Box sx={{
          borderRadius: `${radii.xl}px`,
          boxShadow: '0 4px 10px rgba(0,0,0,0.05)',
          border: `1px solid ${alpha(accentColor || theme.palette.divider, accentColor ? 0.2 : 0.1)}`,
          borderTop: accentColor ? `3px solid ${alpha(accentColor, 0.5)}` : undefined,
          overflow: 'hidden', maxWidth: 340, mb: 1.5,
        }}>
          {title && (
            <Box sx={{
              px: 1.5, py: 1,
              background: `linear-gradient(135deg, ${alpha(accentColor || theme.palette.primary.main, 0.06)}, transparent)`,
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
            }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', color: accentColor }}>{title}</Typography>
            </Box>
          )}
          <Box sx={{ px: 1.5, py: 1.25 }}>{children}</Box>
        </Box>
      );
    };
    return (
      <Stack spacing={0} sx={{ maxWidth: 600 }}>
        <Section title="Default card" desc="Neutral border, subtle shadow">
          <Card title="Your Question">
            <Typography sx={{ fontSize: '0.85rem' }}>What year did the Berlin Wall fall?</Typography>
          </Card>
        </Section>
        <Section title="Result card — correct" desc="Green top accent + header color">
          <Card accentColor={colors.result.correct} title="Correct!">
            <Typography sx={{ fontSize: '0.85rem' }}>+1 pt earned · streak 3</Typography>
          </Card>
        </Section>
        <Section title="Result card — incorrect" desc="Red top accent + header color">
          <Card accentColor={colors.result.incorrect} title="Not quite">
            <Typography sx={{ fontSize: '0.85rem' }}>Try again tomorrow</Typography>
          </Card>
        </Section>
        <Section title="History card — correct" desc="Same pattern for historical entries">
          <Card accentColor={colors.result.correct}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 500, mb: 0.5 }}>In what year did the Berlin Wall fall?</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Selected: 1989 · +1 pt</Typography>
          </Card>
        </Section>
      </Stack>
    );
  },
};
