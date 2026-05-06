import { Box } from '@mui/material';

import CategoryChip from './CategoryChip';

import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof CategoryChip> = {
  title: 'Leaderboard/CategoryChip',
  component: CategoryChip,
  parameters: { layout: 'centered' },
  args: {
    category: 'History & Politics',
  },
};
export default meta;
type Story = StoryObj<typeof CategoryChip>;

export const Default: Story = {};

export const WithScore: Story = {
  args: { score: 42 },
};

export const Custom: Story = {
  args: { category: 'Custom' },
};

export const Small: Story = {
  args: { size: 'small' },
};

export const AllCategories: Story = {
  render: () => (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', maxWidth: 400 }}>
      <CategoryChip category="History & Politics" />
      <CategoryChip category="Science & Nature" />
      <CategoryChip category="Geography & Travel" />
      <CategoryChip category="Pop Culture" />
      <CategoryChip category="Sports & Games" />
      <CategoryChip category="Literature & Arts" />
      <CategoryChip category="Custom" />
    </Box>
  ),
};
