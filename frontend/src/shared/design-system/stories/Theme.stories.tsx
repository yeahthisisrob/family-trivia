import StarIcon from '@mui/icons-material/Star';
import { Box, Typography, Stack, Divider, Avatar, Button, IconButton, Chip } from '@mui/material';
import React from 'react';


import { colors } from '../tokens/colors';
import { radii } from '../tokens/radii';
import { shadows } from '../tokens/shadows';
import { spacing } from '../tokens/spacing';
import { typography } from '../tokens/typography';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Theme',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Design tokens for the Family Trivia mobile-first design system. All colors, typography, spacing, and other visual properties are defined here.',
      },
    },
  },
};
export default meta;

type Story = StoryObj;

// ─── Helper ────────────────────────────────────────────────────────────────────

const Swatch = ({ color, label }: { color: string; label: string }) => (
  <Box sx={{ textAlign: 'center', minWidth: 72 }}>
    <Box
      sx={{
        width: 48,
        height: 48,
        borderRadius: 1,
        bgcolor: color,
        border: '1px solid rgba(0,0,0,0.1)',
        mx: 'auto',
        mb: 0.5,
      }}
    />
    <Typography variant="caption" sx={{ fontSize: '0.625rem', wordBreak: 'break-all' }}>
      {label}
    </Typography>
    <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
      {color}
    </Typography>
  </Box>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 4 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

// ─── Colors Story ──────────────────────────────────────────────────────────────

export const Colors: Story = {
  render: () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Color Tokens
      </Typography>

      <Section title="Brand">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Swatch color={colors.brand.primary} label="primary" />
          <Swatch color={colors.brand.primaryLight} label="primaryLight" />
          <Swatch color={colors.brand.primaryDark} label="primaryDark" />
          <Swatch color={colors.brand.secondary} label="secondary" />
          <Swatch color={colors.brand.secondaryLight} label="secondaryLight" />
          <Swatch color={colors.brand.secondaryDark} label="secondaryDark" />
        </Stack>
      </Section>

      <Section title="Difficulty">
        <Stack direction="row" spacing={1}>
          <Swatch color={colors.difficulty.easy} label="easy" />
          <Swatch color={colors.difficulty.normal} label="normal" />
          <Swatch color={colors.difficulty.hard} label="hard" />
        </Stack>
      </Section>

      <Section title="Result">
        <Stack direction="row" spacing={1}>
          <Swatch color={colors.result.correct} label="correct" />
          <Swatch color={colors.result.incorrect} label="incorrect" />
        </Stack>
      </Section>

      <Section title="Medal">
        <Stack direction="row" spacing={1}>
          <Swatch color={colors.medal.gold} label="gold" />
          <Swatch color={colors.medal.silver} label="silver" />
          <Swatch color={colors.medal.bronze} label="bronze" />
        </Stack>
      </Section>

      <Section title="Category">
        <Stack direction="row" spacing={1}>
          <Swatch color={colors.category.custom} label="custom" />
          <Swatch color={colors.category.default} label="default" />
        </Stack>
      </Section>

      <Section title="User Avatars">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {colors.user.map((c, i) => (
            <Avatar key={i} sx={{ bgcolor: c, width: 40, height: 40, fontSize: '0.75rem' }}>
              U{i + 1}
            </Avatar>
          ))}
        </Stack>
      </Section>

      <Section title="Surfaces">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Swatch color={colors.surface.default} label="default" />
          <Swatch color={colors.surface.card} label="card" />
          <Swatch color={colors.surface.header} label="header" />
          <Swatch color={colors.surface.subtle} label="subtle" />
        </Stack>
      </Section>

      <Section title="Casino Rush">
        <Stack direction="row" spacing={1}>
          <Swatch color={colors.casinoRush.background} label="bg" />
          <Swatch color={colors.casinoRush.surface} label="surface" />
          <Swatch color={colors.casinoRush.accent} label="accent" />
          <Swatch color={colors.casinoRush.gold} label="gold" />
        </Stack>
      </Section>
    </Box>
  ),
};

// ─── Typography Story ──────────────────────────────────────────────────────────

export const TypographyScale: Story = {
  render: () => {
    const variants = ['h1', 'h2', 'h3', 'subtitle1', 'subtitle2', 'body1', 'body2', 'caption', 'chip'] as const;

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
          Typography Scale (Mobile-First)
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 3, display: 'block' }}>
          Optimized for 375px viewport (iPhone SE)
        </Typography>

        <Stack spacing={2} divider={<Divider />}>
          {variants.map((name) => {
            const token = typography[name];
            return (
              <Box key={name} sx={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                <Box sx={{ minWidth: 80 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                    {name}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ ...token }}>
                    The quick brown fox jumps over the lazy dog
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {token.fontSize} / {token.fontWeight}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      </Box>
    );
  },
};

// ─── Spacing & Touch Targets Story ─────────────────────────────────────────────

export const SpacingAndTouchTargets: Story = {
  render: () => (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        Spacing & Touch Targets
      </Typography>

      <Section title="Spacing Scale">
        <Stack spacing={1}>
          {(['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const).map((name) => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="caption" sx={{ minWidth: 40, fontFamily: 'monospace' }}>
                {name}
              </Typography>
              <Box
                sx={{
                  width: spacing[name],
                  height: 24,
                  bgcolor: 'primary.main',
                  borderRadius: 0.5,
                  opacity: 0.6,
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {spacing[name]}px
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section title="Touch Targets (48px minimum)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          All interactive elements enforce a {spacing.touchTarget}px minimum tap area for mobile.
        </Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button variant="contained" size="large">
            Button
          </Button>
          <Button variant="outlined" size="large">
            Outlined
          </Button>
          <IconButton color="primary">
            <StarIcon />
          </IconButton>
          <Chip label="Chip" />
        </Stack>
        <Box
          sx={{
            mt: 2,
            p: 1,
            border: '1px dashed',
            borderColor: 'divider',
            borderRadius: 1,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box sx={{ width: 48, height: 48, border: '2px solid red', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="error">48px</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Minimum touch target
          </Typography>
        </Box>
      </Section>

      <Section title="Shadows">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {Object.entries(shadows).map(([name, value]) => (
            <Box
              key={name}
              sx={{
                width: 80,
                height: 80,
                borderRadius: 2,
                bgcolor: 'background.paper',
                boxShadow: value,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {name}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>

      <Section title="Border Radius">
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {Object.entries(radii).map(([name, value]) => (
            <Box key={name} sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: 'primary.light',
                  borderRadius: `${value}px`,
                  mx: 'auto',
                  mb: 0.5,
                }}
              />
              <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                {name}
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary">
                {value}px
              </Typography>
            </Box>
          ))}
        </Stack>
      </Section>
    </Box>
  ),
};
