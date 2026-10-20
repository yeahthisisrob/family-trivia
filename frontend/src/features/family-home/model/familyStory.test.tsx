import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { useKnowledge } from '../../../entities/family';
import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { KNOWLEDGE } from '../ui/familyHomeMocks';
import { useBuildKnowledge, useFamilyStory, useWriteStory } from './familyStory';

const story = (markdown: string | null) => ({
  markdown,
  generatedAt: markdown ? '2026-10-20T12:00:00Z' : null,
  stats: { people: 11, playing: 8, households: 2, answers: 1284, since: '2025-06-01' },
});

const asked = (fetch: ReturnType<typeof fakeApi>, path: string) =>
  fetch.mock.calls.filter(([url]) => new URL(url).pathname === path).length;

describe("Us: the admin's changes", () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('a story written again shows at once, without asking for it again', async () => {
    const fetch = fakeApi({
      'GET /family/story': () => story(null),
      'POST /admin/family/story': () => story('A family of early risers.'),
    });
    let write: () => Promise<unknown> = async () => undefined;
    const Hero: React.FC = () => {
      const writing = useWriteStory();
      write = () => writing.mutateAsync();
      return <p>{useFamilyStory().data?.markdown ?? 'no story yet'}</p>;
    };
    openTabIn('home');
    const view = renderWithServerData(<Hero />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('no story yet'));

    await act(async () => {
      await write();
    });
    await vi.waitFor(() => expect(view.container.textContent).toBe('A family of early risers.'));
    expect(asked(fetch, '/family/story')).toBe(1);
    view.unmount();
  });

  test('reading answers into the index runs batch by batch, then asks for the index again', async () => {
    let left = 2;
    const fetch = fakeApi({
      'GET /family/knowledge': () => ({ ...KNOWLEDGE, unread: left }),
      'POST /admin/knowledge/build': () => {
        left -= 1;
        return { read: 1, personas: 0, left, failures: [] };
      },
    });
    const batches: number[] = [];
    let run: () => Promise<unknown> = async () => undefined;
    const Admin: React.FC = () => {
      const build = useBuildKnowledge({
        onBatch: (b) => batches.push(b.left),
        stopped: () => false,
      });
      run = () => build.mutateAsync();
      return <p>{useKnowledge().data?.unread}</p>;
    };
    openTabIn('home');
    const view = renderWithServerData(<Admin />);
    await vi.waitFor(() => expect(view.container.textContent).toBe('2'));

    await act(async () => {
      await run();
    });
    expect(batches).toEqual([1, 0]);
    await vi.waitFor(() => expect(view.container.textContent).toBe('0'));
    expect(asked(fetch, '/family/knowledge')).toBe(2);
    view.unmount();
  });
});
