import { http, HttpResponse } from 'msw';

import PhotosPage from './index';
import { StoryProviders } from '../../test/storyContexts';

import type { Meta, StoryObj } from '@storybook/react-vite';

const API = '/api';

const meta: Meta<typeof PhotosPage> = {
  title: 'Photos/PhotosPage',
  component: PhotosPage,
  parameters: { layout: 'padded' },
  args: { userId: 'alice' },
  decorators: [(Story) => <StoryProviders><Story /></StoryProviders>],
};
export default meta;
type Story = StoryObj<typeof PhotosPage>;

const sampleAlbums = [
  {
    id: 'alb_1',
    name: 'Summer 2025',
    description: 'Beach trip and the cousin reunion in July.',
    url: 'https://photos.app.goo.gl/example1',
    createdBy: 'alice',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alb_2',
    name: "Grandma's 80th",
    description: 'Surprise party and slideshow night.',
    url: 'https://photos.app.goo.gl/example2',
    createdBy: 'bob',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'alb_3',
    name: 'Holiday 2025',
    description: 'Christmas morning and the ski trip after.',
    url: 'https://photos.app.goo.gl/example3',
    createdBy: 'alice',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const Default: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/photo-albums`, () => HttpResponse.json({ albums: sampleAlbums })),
      ],
    },
  },
};

export const AsAdmin: Story = {
  args: { userId: 'alice', isAdmin: true },
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/photo-albums`, () => HttpResponse.json({ albums: sampleAlbums })),
      ],
    },
  },
};

export const Empty: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/photo-albums`, () => HttpResponse.json({ albums: [] })),
      ],
    },
  },
};

export const Error: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get(`${API}/photo-albums`, () => HttpResponse.json({ ok: false, error: 'boom' }, { status: 500 })),
      ],
    },
  },
};
