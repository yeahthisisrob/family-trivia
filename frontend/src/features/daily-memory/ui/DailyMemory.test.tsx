import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, later, openTabIn, renderWithServerData } from '../../../test/serverData';
import { DailyMemory } from './DailyMemory';

const memoryOf = (question: string) => ({
  memory: {
    date: '2026-10-16',
    asked: '2024-10-16',
    question,
    kind: 'on-this-day',
    answers: [{ id: 'bob_1', personId: 'bob', answer: 'Coffee on the porch' }],
  },
});

const CREW = 'What was the best road trip?';
const HOME = 'What did Grandma always cook?';

describe("Home's memory a day is cached per circle", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("after a switch, nothing from the other circle's cache shows, even for a moment", async () => {
    const home = later<unknown>();
    fakeApi({
      'GET /family/memory': (circle) => (circle === 'crew' ? memoryOf(CREW) : home.promise),
    });

    openTabIn('crew');
    const crew = renderWithServerData(<DailyMemory me="alice" nameOf={(id) => id} />);
    await vi.waitFor(() => expect(crew.container.textContent).toContain(CREW));
    crew.unmount();

    // Same page, same cache: the tab now asks in its other circle.
    openTabIn('home');
    const again = renderWithServerData(<DailyMemory me="alice" nameOf={(id) => id} />, crew.client);
    await new Promise((r) => setTimeout(r, 20));
    expect(again.container.textContent).not.toContain(CREW);

    home.settle(memoryOf(HOME));
    await vi.waitFor(() => expect(again.container.textContent).toContain(HOME));
    expect(again.container.textContent).not.toContain(CREW);
    again.unmount();
  });

  test('while mounted, a new circle shows nothing until its own answer arrives', async () => {
    const home = later<unknown>();
    fakeApi({
      'GET /family/memory': (circle) => (circle === 'crew' ? memoryOf(CREW) : home.promise),
    });

    openTabIn('crew');
    const view = renderWithServerData(<DailyMemory me="alice" nameOf={(id) => id} />);
    await vi.waitFor(() => expect(view.container.textContent).toContain(CREW));

    openTabIn('home');
    view.rerender(<DailyMemory me="alice" nameOf={(id) => id} />);
    expect(view.container.textContent).not.toContain(CREW);

    home.settle(memoryOf(HOME));
    await vi.waitFor(() => expect(view.container.textContent).toContain(HOME));
    view.unmount();
  });
});
