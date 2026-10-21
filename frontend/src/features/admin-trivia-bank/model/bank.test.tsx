import { CIRCLE_HEADER } from '@family-trivia/shared';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { useCircleQuery } from '../../../shared/api/query';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { SYSTEM_INFO } from '../../admin-system';
import { useBankPage, useBankStats, useDeleteBankQuestion, useImportQuestions } from './bank';

const stats = (circle: string | null, total: number) => ({
  totalQuestions: total,
  categories: [
    {
      category: `${circle} Science`,
      count: total,
      difficulties: { easy: 0, normal: total, hard: 0 },
    },
  ],
  sources: [['opentdb', total]],
  questionsAsked: 0,
});

const asked = (fetch: ReturnType<typeof fakeApi>, method: string, path: string) =>
  fetch.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && new URL(url).pathname === path,
  );
const circleOf = (call: [string, RequestInit?] | undefined) =>
  (call?.[1]?.headers as Record<string, string> | undefined)?.[CIRCLE_HEADER];

const PAGE = { category: 'Science & Nature', difficulty: 'normal', offset: 0 };

/** The bank's numbers and a page of it, beside Admin › System's count. */
let importSome: () => Promise<unknown> = async () => undefined;
let remove: () => Promise<unknown> = async () => undefined;
const Bank: React.FC = () => {
  const numbers = useBankStats();
  const page = useBankPage(PAGE);
  useCircleQuery({ key: SYSTEM_INFO, path: '/admin/system-info' });
  const importing = useImportQuestions();
  const deleting = useDeleteBankQuestion();
  importSome = () =>
    importing.mutateAsync({
      source: 'opentdb',
      category: 'Science & Nature',
      difficulty: 'normal',
      count: 50,
    });
  remove = () => deleting.mutateAsync({ ...PAGE, question: 'Which planet is red?' });
  return (
    <p>
      {numbers.data?.categories[0]?.category} {numbers.data?.totalQuestions},{' '}
      {page.data?.total ?? 0} on the page
    </p>
  );
};

describe('the trivia bank', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("an import or a delete asks again for the bank and System's count", async () => {
    let total = 2;
    const fetch = fakeApi({
      'GET /admin/trivia-bank/stats': (circle) => stats(circle, total),
      'GET /admin/trivia-bank/browse': () => ({ questions: [], total }),
      'GET /admin/system-info': () => ({}),
      'POST /admin/trivia-bank/import': () => {
        total += 1;
        return {
          source: 'OpenTDB',
          category: 'Science & Nature',
          difficulty: 'normal',
          fetched: 1,
          added: 1,
          duplicates: 0,
          errors: 0,
        };
      },
      'DELETE /admin/trivia-bank/question': () => {
        total -= 1;
        return { deleted: true };
      },
    });
    openTabIn('home');
    const view = renderWithServerData(<Bank />);
    await vi.waitFor(() =>
      expect(view.container.textContent).toBe('home Science 2, 2 on the page'),
    );

    await act(async () => {
      await importSome();
    });
    await vi.waitFor(() =>
      expect(view.container.textContent).toBe('home Science 3, 3 on the page'),
    );
    expect(asked(fetch, 'GET', '/admin/system-info')).toHaveLength(2);

    await act(async () => {
      await remove();
    });
    await vi.waitFor(() =>
      expect(view.container.textContent).toBe('home Science 2, 2 on the page'),
    );
    expect(asked(fetch, 'GET', '/admin/system-info')).toHaveLength(3);
    view.unmount();
  });

  test('an admin of two circles sees and imports into only the circle on screen', async () => {
    const fetch = fakeApi({
      'GET /admin/trivia-bank/stats': (circle) => stats(circle, 2),
      'GET /admin/trivia-bank/browse': () => ({ questions: [], total: 2 }),
      'POST /admin/trivia-bank/import': () => ({
        source: 'OpenTDB',
        category: 'Science & Nature',
        difficulty: 'normal',
        fetched: 0,
        added: 0,
        duplicates: 0,
        errors: 0,
      }),
    });
    openTabIn('crew');
    const crew = renderWithServerData(<Bank />);
    await vi.waitFor(() =>
      expect(crew.container.textContent).toBe('crew Science 2, 2 on the page'),
    );
    crew.unmount();

    openTabIn('home');
    const home = renderWithServerData(<Bank />, crew.client);
    expect(home.container.textContent).toBe(' , 0 on the page');
    await vi.waitFor(() =>
      expect(home.container.textContent).toBe('home Science 2, 2 on the page'),
    );
    await act(async () => {
      await importSome();
    });
    const imports = asked(fetch, 'POST', '/admin/trivia-bank/import');
    expect(imports).toHaveLength(1);
    expect(circleOf(imports[0])).toBe('home');
    const crewBank = crew.client
      .getQueryCache()
      .findAll({ queryKey: ['circle', 'crew', 'admin', 'trivia-bank'] });
    expect(crewBank).toHaveLength(2);
    expect(crewBank.every((q) => !q.state.isInvalidated)).toBe(true);
    home.unmount();
  });
});
