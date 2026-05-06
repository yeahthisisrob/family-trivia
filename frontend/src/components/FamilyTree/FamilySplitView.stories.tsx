import React from 'react';
import { expect, userEvent, within } from 'storybook/test';

import FamilySplitView from './FamilySplitView';

import type { FamilyHierarchy } from '../../api';
import type { Meta, StoryObj } from '@storybook/react-vite';

// ── Mock data ────────────────────────────────────────────────────────

const mockHierarchy: FamilyHierarchy = {
  version: '1.0',
  family: {
    name: 'Demo Family',
    root: {
      partners: [{ id: 'dad' }, { id: 'mom' }],
    },
    relationships: [
      { type: 'partners', partner1: 'dad', partner2: 'mom' },
      { type: 'partners', partner1: 'alice', partner2: 'frank' },
      { type: 'partners', partner1: 'dave', partner2: 'grace' },
    ],
    sides: {
      paternal: { name: "Dad's Side", color: '#2196F3', groups: ['smiths', 'jones'] },
      maternal: { name: "Mom's Side", color: '#FF9800', groups: ['johnsons', 'browns'] },
    },
    groups: {
      parents: { name: 'Mom & Dad', members: ['dad', 'mom'] },
      smiths: { name: 'The Smiths', members: ['alice', 'frank', 'charlie'] },
      jones: { name: 'The Joneses', members: ['bob'] },
      johnsons: { name: 'The Johnsons', members: ['dave', 'grace', 'hannah'] },
      browns: { name: 'The Browns', members: ['eve'] },
    },
    people: {
      dad: { name: 'John', groupId: 'parents', familySide: 'paternal' },
      mom: { name: 'Jane', groupId: 'parents', familySide: 'maternal' },
      alice: { name: 'Alice Smith', groupId: 'smiths', familySide: 'paternal' },
      frank: { name: 'Frank Smith', groupId: 'smiths', familySide: 'paternal' },
      charlie: { name: 'Charlie Smith', groupId: 'smiths', familySide: 'paternal' },
      bob: { name: 'Bob Jones', groupId: 'jones', familySide: 'paternal' },
      dave: { name: 'Dave Johnson', groupId: 'johnsons', familySide: 'maternal' },
      grace: { name: 'Grace Johnson', groupId: 'johnsons', familySide: 'maternal' },
      hannah: { name: 'Hannah Johnson', groupId: 'johnsons', familySide: 'maternal' },
      eve: { name: 'Eve Brown', groupId: 'browns', familySide: 'maternal' },
    },
  },
} as any;

const mockDescriptions: Record<string, string> = {
  parents: 'The heart of the family, married 35 years.',
  smiths: 'Always up for game night and friendly competition.',
  johnsons: 'The adventurous side — always planning the next trip.',
};

// ── Meta ─────────────────────────────────────────────────────────────

const meta: Meta<typeof FamilySplitView> = {
  title: 'FamilyTree/FamilySplitView',
  component: FamilySplitView,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Split-view family tree organized by paternal/maternal sides. Shows center group (root couple) at top, then side-by-side columns. Groups contain couple badges (with heart) and individual person badges with initials avatars.',
      },
    },
  },
  args: {
    hierarchy: mockHierarchy,
    groupDescriptions: mockDescriptions,
    currentUserId: 'alice',
    onMemberClick: () => {},
  },
  argTypes: {
    currentUserId: {
      control: 'select',
      options: ['dad', 'mom', 'alice', 'frank', 'charlie', 'bob', 'dave', 'grace', 'hannah', 'eve'],
    },
    onMemberClick: { action: 'memberClicked' },
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420, margin: '0 auto', background: '#f9f9f9', padding: 8, borderRadius: 12, minHeight: 300 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof FamilySplitView>;

// ── Stories ──────────────────────────────────────────────────────────

/** Full family tree with center group, two sides, couples, and singles */
export const FullTree: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Root couple visible
    await expect(canvas.getByText('Mom & Dad')).toBeInTheDocument();
    await expect(canvas.getByText('John')).toBeInTheDocument();
    await expect(canvas.getByText('Jane')).toBeInTheDocument();
    // Both sides visible
    await expect(canvas.getByText("Dad's Side")).toBeInTheDocument();
    await expect(canvas.getByText("Mom's Side")).toBeInTheDocument();
    // Groups visible
    await expect(canvas.getByText('The Smiths')).toBeInTheDocument();
    await expect(canvas.getByText('The Johnsons')).toBeInTheDocument();
    // Current user highlighted
    await expect(canvas.getByText('Alice Smith')).toBeInTheDocument();
    await expect(canvas.getByText('YOU')).toBeInTheDocument();
  },
};

/** Current user on the maternal side */
export const MaternalUser: Story = {
  args: { currentUserId: 'dave' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Dave Johnson')).toBeInTheDocument();
    await expect(canvas.getByText('YOU')).toBeInTheDocument();
  },
};

/** Root couple member highlighted */
export const RootMember: Story = {
  args: { currentUserId: 'dad' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('John')).toBeInTheDocument();
    await expect(canvas.getByText('YOU')).toBeInTheDocument();
  },
};

/** With group descriptions showing italic quotes */
export const WithDescriptions: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/heart of the family/)).toBeInTheDocument();
    await expect(canvas.getByText(/game night/)).toBeInTheDocument();
    await expect(canvas.getByText(/adventurous side/)).toBeInTheDocument();
  },
};

/** No group descriptions */
export const NoDescriptions: Story = {
  args: { groupDescriptions: {} },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Groups still show, just no quotes
    await expect(canvas.getByText('The Smiths')).toBeInTheDocument();
    await expect(canvas.queryByText(/heart of the family/)).not.toBeInTheDocument();
  },
};

/** Single person (not part of a couple) */
export const SingleMemberHighlighted: Story = {
  args: { currentUserId: 'bob' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Bob Jones')).toBeInTheDocument();
    await expect(canvas.getByText('YOU')).toBeInTheDocument();
  },
};

/** Minimal hierarchy — no sides, just one group */
export const NoSides: Story = {
  args: {
    hierarchy: {
      version: '1.0',
      family: {
        name: 'Small Family',
        root: { partners: [] },
        relationships: [],
        sides: {},
        groups: {
          family: { name: 'The Family', members: ['alice', 'bob'] },
        },
        people: {
          alice: { name: 'Alice', groupId: 'family' },
          bob: { name: 'Bob', groupId: 'family' },
        },
      },
    } as any,
    groupDescriptions: {},
    currentUserId: 'alice',
  },
  parameters: {
    docs: { description: { story: 'When no sides are defined, all groups render as center groups.' } },
  },
};

/** Click a member badge */
export const ClickMember: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const bobBadge = canvas.getByText('Bob Jones');
    await userEvent.click(bobBadge);
  },
};
