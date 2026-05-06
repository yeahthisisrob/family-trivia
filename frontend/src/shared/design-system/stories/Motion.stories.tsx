import { Box, Typography, Stack, Paper } from '@mui/material';
import { keyframes } from '@mui/material/styles';
import React from 'react';

import { motion } from '../tokens/motion';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta = {
  title: 'Design System/Motion',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Motion tokens provide consistent easing curves and durations across the app. Use `motion.ease.*` and `motion.duration.*` anywhere you need animation, so state transitions and micro-interactions feel cohesive.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const slide = keyframes`
  0% { transform: translateX(0); }
  50% { transform: translateX(160px); }
  100% { transform: translateX(0); }
`;

const Demo: React.FC<{ label: string; easing: string; duration: string }> = ({ label, easing, duration }) => (
  <Paper sx={{ p: 2, mb: 1.5 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: 'monospace' }}>
        {duration} · {easing}
      </Typography>
    </Box>
    <Box sx={{ position: 'relative', height: 30, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
      <Box sx={{
        position: 'absolute',
        top: 5,
        left: 5,
        width: 20,
        height: 20,
        borderRadius: '50%',
        bgcolor: 'primary.main',
        animation: `${slide} 2s ${easing} infinite`,
      }} />
    </Box>
  </Paper>
);

export const EasingCurves: Story = {
  render: () => (
    <Stack spacing={0} sx={{ maxWidth: 500 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Easing Curves</Typography>
      <Demo label="bounce — slight overshoot on entrance" easing={motion.ease.bounce} duration="2s" />
      <Demo label="smooth — standard in/out" easing={motion.ease.smooth} duration="2s" />
      <Demo label="snappy — quick in, gentle out" easing={motion.ease.snappy} duration="2s" />
    </Stack>
  ),
};

export const Durations: Story = {
  render: () => (
    <Stack spacing={0} sx={{ maxWidth: 500 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Durations</Typography>
      <Demo label={`fast — ${motion.duration.fast} (micro-interactions)`} easing={motion.ease.smooth} duration={motion.duration.fast} />
      <Demo label={`normal — ${motion.duration.normal} (default)`} easing={motion.ease.smooth} duration={motion.duration.normal} />
      <Demo label={`slow — ${motion.duration.slow} (entrances, celebrations)`} easing={motion.ease.smooth} duration={motion.duration.slow} />
    </Stack>
  ),
};

export const Tokens: Story = {
  render: () => (
    <Stack spacing={2} sx={{ maxWidth: 600 }}>
      <Typography variant="h6">Motion Tokens</Typography>
      <Paper sx={{ p: 2 }}>
        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre' }}>
{`import { motion } from '@/shared/design-system/tokens/motion';

// Use in sx or styled:
sx={{
  transition: \`all \${motion.duration.fast} \${motion.ease.smooth}\`,
}}

// Or in a keyframes animation:
sx={{
  animation: \`\${fadeSlideIn} \${motion.duration.normal} \${motion.ease.bounce}\`,
}}`}
        </Typography>
      </Paper>
    </Stack>
  ),
};
