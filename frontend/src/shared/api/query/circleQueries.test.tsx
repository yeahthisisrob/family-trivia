import { CIRCLE_HEADER } from '@family-trivia/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { fakeApi, later, openTabIn, renderWithServerData } from '../../../test/serverData';
import { clearSession } from '../../session/session';
import { apiService } from '../ApiService';
import {
  keys,
  useCircleInfiniteQuery,
  useCircleInvalidate,
  useCircleMutation,
  useCircleQuery,
} from './circleQueries';

const answered = (circle: string | null, limit: string | null) => ({
  birthdays: [{ name: `${circle} date ${limit}` }],
  todaysBirthdays: [],
});

/** Shows the first date's name, the way a card would. */
const Dates: React.FC<{ limit: number }> = ({ limit }) => {
  const q = useCircleQuery({
    key: ['celebrations', 'upcoming'],
    path: '/upcoming-birthdays',
    query: { limit },
    keepPrevious: true,
  });
  return <p>{q.data?.birthdays[0]?.name ?? 'nothing yet'}</p>;
};

describe('server data is kept per circle', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("every key starts with the tab's circle", () => {
    openTabIn('crew');
    expect(keys.circle('plans', 'view')).toEqual(['circle', 'crew', 'plans', 'view']);
    openTabIn('home');
    expect(keys.circle('plans', 'view')).toEqual(['circle', 'home', 'plans', 'view']);
  });

  test('each request names the circle of its key, and is answered there', async () => {
    const fetch = fakeApi({
      'GET /upcoming-birthdays': (circle, url) => answered(circle, url.searchParams.get('limit')),
    });
    openTabIn('crew');
    const view = renderWithServerData(<Dates limit={10} />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew date 10'));
    expect(fetch).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  test("keeping the last answer while a longer list loads never keeps another circle's", async () => {
    const homeAnswer = later<unknown>();
    fakeApi({
      'GET /upcoming-birthdays': (circle) =>
        circle === 'crew' ? answered('crew', '10') : homeAnswer.promise,
    });
    openTabIn('crew');
    const view = renderWithServerData(<Dates limit={10} />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew date 10'));

    openTabIn('home');
    view.rerender(<Dates limit={20} />);
    expect(view.container.textContent).toBe('nothing yet');

    await act(async () => homeAnswer.settle(answered('home', '20')));
    await vi.waitFor(() => expect(view.container.textContent).toBe('home date 20'));
    view.unmount();
  });

  test('signing out drops everything that was loaded', async () => {
    fakeApi({ 'GET /upcoming-birthdays': (circle) => answered(circle, '10') });
    openTabIn('crew');
    const view = renderWithServerData(<Dates limit={10} />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew date 10'));
    expect(view.client.getQueryCache().getAll()).toHaveLength(1);

    act(() => clearSession());
    expect(view.client.getQueryCache().getAll()).toHaveLength(0);
    view.unmount();
  });

  test("after a mutation, this circle's reads are asked again before it resolves", async () => {
    let saved = 0;
    const fetch = fakeApi({
      'GET /upcoming-birthdays': (circle) => answered(`${circle}#${saved}`, '10'),
      'POST /celebrations': () => {
        saved++;
        return { success: true };
      },
    });
    let add: () => Promise<unknown> = async () => undefined;
    const Adder: React.FC = () => {
      const m = useCircleMutation({
        mutationFn: () => apiService.request('/celebrations', { method: 'POST' }),
        invalidates: [['celebrations']],
      });
      add = () => m.mutateAsync();
      return <Dates limit={10} />;
    };
    openTabIn('crew');
    const view = renderWithServerData(<Adder />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew#0 date 10'));

    await act(async () => {
      await add();
    });
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew#1 date 10'));
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('upcoming'))).toHaveLength(2);
    view.unmount();
  });

  test('a mutation that refreshes in the background resolves before its reads answer', async () => {
    let asks = 0;
    const second = later<unknown>();
    fakeApi({
      'GET /upcoming-birthdays': (circle) =>
        ++asks === 1 ? answered(circle, '10') : second.promise,
      'POST /celebrations': () => ({ success: true }),
    });
    let add: () => Promise<unknown> = async () => undefined;
    const Adder: React.FC = () => {
      const m = useCircleMutation({
        mutationFn: () => apiService.request('/celebrations', { method: 'POST' }),
        invalidates: [['celebrations']],
        refreshInBackground: true,
      });
      add = () => m.mutateAsync();
      return <Dates limit={10} />;
    };
    openTabIn('crew');
    const view = renderWithServerData(<Adder />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew date 10'));

    await act(async () => {
      await add();
    });
    expect(asks).toBe(2);
    await act(async () => second.settle(answered('crew', 'again')));
    await vi.waitFor(() => expect(view.container.textContent).toBe('crew date again'));
    view.unmount();
  });

  test('a change saved elsewhere asks again for the reads it names, in this circle only', async () => {
    let saved = 0;
    const fetch = fakeApi({
      'GET /upcoming-birthdays': (circle) => answered(`${circle}#${saved}`, '10'),
    });
    let refresh: () => Promise<void> = async () => undefined;
    const Card: React.FC = () => {
      const invalidate = useCircleInvalidate();
      refresh = () => invalidate(['celebrations']);
      return <Dates limit={10} />;
    };
    openTabIn('crew');
    const crew = renderWithServerData(<Card />);
    await vi.waitFor(() => expect(crew.container.textContent).toBe('crew#0 date 10'));
    crew.unmount();
    openTabIn('home');
    const home = renderWithServerData(<Card />, crew.client);
    await vi.waitFor(() => expect(home.container.textContent).toBe('home#0 date 10'));
    const asked = () => fetch.mock.calls.filter(([url]) => String(url).includes('upcoming'));

    saved++;
    await act(async () => {
      await refresh();
    });
    await vi.waitFor(() => expect(home.container.textContent).toBe('home#1 date 10'));
    expect(asked()).toHaveLength(3);
    const crewDates = [
      'circle',
      'crew',
      'celebrations',
      'upcoming',
      '/upcoming-birthdays',
      '{"limit":10}',
    ];
    expect(crew.client.getQueryState(crewDates)?.isInvalidated).toBe(false);
    home.unmount();
  });

  test('a list read page by page asks for every page in the circle of its key', async () => {
    const fetch = fakeApi({
      'GET /timeline-data': (circle, url) => {
        const before = url.searchParams.get('before');
        return {
          timelineData: { facts: [], trivia: [] },
          familySides: {},
          pagination: {
            hasMoreFacts: !before,
            hasMoreTrivia: false,
            nextFactCursor: before ? null : `${circle}-cursor`,
            nextTriviaCursor: null,
          },
          success: true,
        };
      },
    });
    let more: () => Promise<unknown> = async () => undefined;
    const Pages: React.FC = () => {
      const q = useCircleInfiniteQuery({
        key: ['timeline'],
        path: '/timeline-data',
        query: { side: 'all' },
        next: (page) =>
          page.pagination.nextFactCursor
            ? { side: 'all', before: page.pagination.nextFactCursor }
            : undefined,
        select: (pages) => pages.length,
      });
      more = () => q.fetchNextPage();
      return <p>{q.data ?? 0} pages</p>;
    };
    openTabIn('crew');
    const view = renderWithServerData(<Pages />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('1 pages'));
    await act(async () => {
      await more();
    });
    await vi.waitFor(() => expect(view.container.textContent).toBe('2 pages'));
    const asked = fetch.mock.calls.map(([url, init]) => ({
      before: new URL(url).searchParams.get('before'),
      circle: (init?.headers as Record<string, string> | undefined)?.[CIRCLE_HEADER],
    }));
    expect(asked).toEqual([
      { before: null, circle: 'crew' },
      { before: 'crew-cursor', circle: 'crew' },
    ]);
    expect(view.client.getQueryCache().getAll()[0]?.queryKey.slice(0, 3)).toEqual([
      'circle',
      'crew',
      'timeline',
    ]);
    view.unmount();
  });
});
