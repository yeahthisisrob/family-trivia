/**
 * Render a component with its own server-data cache (docs/decisions/0035),
 * and answer its requests per circle, as the API does (X-Circle).
 */
import { CIRCLE_HEADER } from '@family-trivia/shared';
import type { QueryClient } from '@tanstack/react-query';
import type React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { vi } from 'vitest';
import { createQueryClient, ServerDataProvider } from '../shared/api/query';
import { forgetTab, saveCircles } from '../shared/session/session';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Mount `ui` with a fresh QueryClient (retries off, as in the app). */
export function renderWithServerData(
  ui: React.ReactNode,
  client: QueryClient = createQueryClient(),
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const render = (next: React.ReactNode) =>
    act(() => root.render(<ServerDataProvider client={client}>{next}</ServerDataProvider>));
  render(ui);
  return {
    container,
    client,
    rerender: render,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const CIRCLES = [
  { id: 'crew', name: 'The Crew', kind: 'friends' as const, userId: 'alice' },
  { id: 'home', name: 'The Smiths', kind: 'family' as const, userId: 'alice' },
];

/** This tab opens in a made-up circle (the app reloads on a real switch). */
export function openTabIn(circle: 'crew' | 'home') {
  forgetTab();
  localStorage.setItem(
    'familyTriviaSession',
    JSON.stringify({ userId: 'alice', token: 't', email: 'alice@example.com' }),
  );
  saveCircles(circle, CIRCLES);
}

type Answer = (circle: string | null, url: URL) => unknown | Promise<unknown>;

/**
 * A fake API: `routes` maps "GET /path" to the `data` it answers, given the
 * circle the request named. Anything else answers `{}`. Returns the fetch spy.
 */
export function fakeApi(routes: Record<string, Answer>) {
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    const asked = new URL(url);
    const circle = (init.headers as Record<string, string> | undefined)?.[CIRCLE_HEADER] ?? null;
    const answer = routes[`${init.method ?? 'GET'} ${asked.pathname}`];
    const data = answer ? await answer(circle, asked) : {};
    return new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

/** A promise to settle later, to see what shows while a request is out. */
export function later<T>() {
  let settle: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    settle = done;
  });
  return { promise, settle };
}
