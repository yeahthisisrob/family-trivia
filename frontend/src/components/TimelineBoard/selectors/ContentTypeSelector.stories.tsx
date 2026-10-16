import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { fn } from 'storybook/test';
import ContentTypeSelector, { type ContentType } from './ContentTypeSelector';

const Stateful = (props: { initial: ContentType; onChange: (v: ContentType) => void }) => {
  const [value, setValue] = useState<ContentType>(props.initial);
  return (
    <ContentTypeSelector
      value={value}
      onChange={(v) => {
        setValue(v);
        props.onChange(v);
      }}
    />
  );
};

const meta: Meta<typeof Stateful> = {
  title: 'TimelineBoard/ContentTypeSelector',
  component: Stateful,
  parameters: { layout: 'padded' },
  args: { initial: 'funFacts', onChange: fn() },
};
export default meta;
type Story = StoryObj<typeof Stateful>;

export const FactsSelected: Story = { args: { initial: 'funFacts' } };
export const TriviaSelected: Story = { args: { initial: 'triviaHistory' } };
export const CommentsSelected: Story = { args: { initial: 'comments' } };
