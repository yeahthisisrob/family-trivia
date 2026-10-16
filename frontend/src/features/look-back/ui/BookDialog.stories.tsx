import type { Meta, StoryObj } from '@storybook/react-vite';
import { HttpResponse, http } from 'msw';
import { expect, fn, userEvent, within } from 'storybook/test';
import { BookDialog } from './BookDialog';
import { SUMMER } from './lookBackMocks';

const ok = (data: unknown) => HttpResponse.json({ ok: true, data });

const meta: Meta<typeof BookDialog> = {
  title: 'Family/BookDialog',
  component: BookDialog,
  args: { season: SUMMER.season, onClose: fn() },
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.post('*/seasons/book/writing', () =>
          ok({
            writing: {
              tone: 'warm',
              foreword: 'We kept coming back to the beach.',
              chapters: {},
              plan: [{ title: 'Around the table', pages: [], intro: 'Pie came first.' }],
              writtenAt: '2025-08-01T00:00:00Z',
            },
            left: 0,
            chapters: 1,
          }),
        ),
        http.get('*/seasons/book/versions', () =>
          ok({
            versions: [
              {
                tone: 'warm',
                madeAt: '2025-08-01T00:00:00Z',
                pages: 50,
                writtenAt: '2025-08-01T00:00:00Z',
                url: 'https://example.test/old.pdf',
              },
            ],
          }),
        ),
        http.post('*/seasons/book', () =>
          ok({
            url: 'https://example.test/summer.pdf',
            pages: 52,
            tone: 'warm',
            madeAt: '2025-08-01T00:00:00Z',
            made: true,
          }),
        ),
      ],
    },
  },
};
export default meta;
type Story = StoryObj<typeof BookDialog>;

/** Choosing a tone; every book made before is listed and kept. */
export const ChooseHowItsWritten: Story = {
  play: async () => {
    const page = within(document.body);
    await expect(await page.findByText('Every version, kept')).toBeInTheDocument();
    await expect(page.getByText(/Warm · 50 pages/)).toBeInTheDocument();
  },
};

/** Choose a tone, make it, and download the PDF. */
export const MakeTheBook: Story = {
  play: async () => {
    const page = within(document.body);
    await userEvent.click(await page.findByRole('radio', { name: /Playful/ }));
    await expect(page.getByRole('radio', { name: /Playful/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await userEvent.click(page.getByRole('button', { name: 'Make the book' }));
    await expect(await page.findByText(/Your book is ready: 52 pages/)).toBeInTheDocument();
    await expect(page.getByRole('link', { name: 'Download the PDF' })).toHaveAttribute(
      'href',
      'https://example.test/summer.pdf',
    );
  },
};

/** When the server can't make it: a message, never a blank page. */
export const WhenItFails: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('*/seasons/book/versions', () =>
          HttpResponse.json({ ok: false, error: 'Not a downloadable key' }, { status: 500 }),
        ),
        http.post('*/seasons/book/writing', () =>
          HttpResponse.json({ ok: false, error: 'Not a downloadable key' }, { status: 500 }),
        ),
      ],
    },
  },
  play: async () => {
    const page = within(document.body);
    await userEvent.click(await page.findByRole('button', { name: 'Make the book' }));
    await expect(await page.findByRole('alert', {}, { timeout: 15000 })).toBeInTheDocument();
    await expect(page.getByRole('button', { name: 'Make the book' })).toBeInTheDocument();
  },
};
