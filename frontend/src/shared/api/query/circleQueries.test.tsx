import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { fakeApi, later, openTabIn, renderWithServerData } from '../../../test/serverData';
import { clearSession } from '../../session/session';
import { apiService } from '../ApiService';
import { keys, useCircleMutation, useCircleQuery } from './circleQueries';

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
});
