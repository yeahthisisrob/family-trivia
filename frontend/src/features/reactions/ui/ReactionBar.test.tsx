import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, later, openTabIn, renderWithServerData } from '../../../test/serverData';
import { ReactionBar } from './ReactionBar';

const laughs = (n: number) => ({
  by: Array.from({ length: n }, (_, i) => ({ userId: `p${i}`, reaction: 'laugh' })),
  mine: null,
});
const answer = (ids: string | null, summary: unknown) => ({
  reactions: Object.fromEntries((ids ?? '').split(',').map((id) => [id, summary])),
});

// The same answer can show in two circles (a joined circle shows its source's answers, 0018).
const ID = 'bob_2026-10-01T12:00:00.000Z';
const bar = <ReactionBar contentType="fact" contentId={ID} me="alice" />;

describe('reactions are kept per circle', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("after a switch, the other circle's reactions never show, and this circle's are asked for", async () => {
    const home = later<unknown>();
    fakeApi({
      'GET /reactions': (circle, url) =>
        circle === 'crew' ? answer(url.searchParams.get('ids'), laughs(2)) : home.promise,
    });

    openTabIn('crew');
    const view = renderWithServerData(bar);
    await vi.waitFor(() => expect(view.container.textContent).toContain('2'));
    view.unmount();

    openTabIn('home');
    const again = renderWithServerData(bar, view.client);
    await new Promise((r) => setTimeout(r, 60));
    expect(again.container.textContent).not.toContain('2');

    home.settle(answer(ID, laughs(1)));
    await vi.waitFor(() => expect(again.container.textContent).toContain('1'));
    again.unmount();
  });

  test('bars on screen together are asked for in one request', async () => {
    const fetch = fakeApi({
      'GET /reactions': (_circle, url) => answer(url.searchParams.get('ids'), laughs(1)),
    });
    openTabIn('crew');
    const view = renderWithServerData(
      <>
        <ReactionBar contentType="fact" contentId="bob_1" me="alice" />
        <ReactionBar contentType="fact" contentId="carol_1" me="alice" />
      </>,
    );
    await vi.waitFor(() =>
      expect(view.container.querySelectorAll('[aria-label="Ha, 1"]')).toHaveLength(2),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('ids')).toBe('bob_1,carol_1');
    view.unmount();
  });

  test('a tap shows at once, and is put back if saving fails', async () => {
    const fetch = fakeApi({
      'GET /reactions': (_circle, url) => answer(url.searchParams.get('ids'), laughs(0)),
    });
    openTabIn('crew');
    const view = renderWithServerData(bar);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const refused = later<Response>();
    fetch.mockImplementationOnce(() => refused.promise);
    const react = await vi.waitFor(() => {
      const b = view.container.querySelector<HTMLButtonElement>('[aria-label="React"]');
      if (!b) throw new Error('not yet');
      return b;
    });
    act(() => react.click());
    const hug = await vi.waitFor(() => {
      const b = document.body.querySelector<HTMLElement>('[role="menuitem"][aria-label="Hug"]');
      if (!b) throw new Error('not yet');
      return b;
    });
    act(() => hug.click());
    await vi.waitFor(() =>
      expect(view.container.querySelector('[aria-label="Hug, 1"]')).not.toBeNull(),
    );

    refused.settle(
      new Response(JSON.stringify({ ok: false, error: 'Not allowed' }), { status: 400 }),
    );
    await vi.waitFor(() =>
      expect(view.container.querySelector('[aria-label="Hug, 1"]')).toBeNull(),
    );
    view.unmount();
  });
});
