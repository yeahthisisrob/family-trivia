import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import { StoryProviders } from '../../../test/storyContexts';
import FamilySideSelector from './FamilySideSelector';

const Stateful = (props: { initial: string; onChange: (v: string) => void }) => {
  const [value, setValue] = useState(props.initial);
  return (
    <FamilySideSelector
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
};

const meta: Meta<typeof Stateful> = {
  title: 'TimelineBoard/FamilySideSelector',
  component: Stateful,
  parameters: { layout: 'padded' },
  args: { initial: 'all', onChange: fn() },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof Stateful>;

export const All: Story = { args: { initial: 'all' } };
