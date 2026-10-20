import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import type { Family } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';
import { exampleFamily, exampleGraph } from '../../../test/fixtures/exampleFamily';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { useFamily, useFamilyGraph, useSaveFamily } from './reads';

const renamed: Family = { ...exampleFamily, name: 'The Renamed Family' };

const asked = (fetch: ReturnType<typeof fakeApi>, path: string) =>
  fetch.mock.calls.filter(([url]) => new URL(url).pathname === path).length;

describe('saving the family', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('shows the saved family at once and asks for the graph again', async () => {
    let saved = false;
    const fetch = fakeApi({
      'GET /family': () => ({ family: exampleFamily, photoUrls: {} }),
      'PUT /admin/family': () => {
        saved = true;
        return { family: renamed, photoUrls: {} };
      },
      'GET /graph': () => ({ ...exampleGraph, likenesses: saved ? [] : exampleGraph.likenesses }),
    });
    let save: () => Promise<unknown> = async () => undefined;
    const Editor: React.FC = () => {
      const saving = useSaveFamily();
      save = () => saving.mutateAsync(renamed);
      return (
        <>
          <p id="name">{useFamily().family?.name}</p>
          <p id="graph">{useFamilyGraph().data?.people.length}</p>
        </>
      );
    };
    openTabIn('home');
    const view = renderWithServerData(<Editor />);
    const text = (id: string) => view.container.querySelector(`#${id}`)?.textContent;
    await vi.waitFor(() => expect(text('name')).toBe('The Example Family'));
    await vi.waitFor(() => expect(text('graph')).toBe(String(exampleGraph.people.length)));

    await act(async () => {
      await save();
    });
    await vi.waitFor(() => expect(text('name')).toBe('The Renamed Family'));
    expect(asked(fetch, '/family')).toBe(1);
    expect(asked(fetch, '/graph')).toBe(2);
    view.unmount();
  });
});
