import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { FamilyDataContext } from '../../../contexts/FamilyDataContext';
import { useFamily } from '../../../entities/family';
import { apiService } from '../../../shared/api/ApiService';
import { exampleFamily } from '../../../test/fixtures/exampleFamily';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { useAdminGroups, useAdminPlayers, useDeleteGroup, useUpdatePlayer } from './people';

const gets = (fetch: ReturnType<typeof fakeApi>, path: string) =>
  fetch.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === 'GET' && new URL(url).pathname === path,
  ).length;

let move: () => Promise<unknown> = async () => undefined;
let removeGroup: () => Promise<unknown> = async () => undefined;
const People: React.FC = () => {
  const players = useAdminPlayers();
  const groups = useAdminGroups();
  const family = useFamily();
  const updating = useUpdatePlayer();
  const deleting = useDeleteGroup();
  move = () => updating.mutateAsync({ userId: 'bob', group: 'joneses' });
  removeGroup = () => deleting.mutateAsync('joneses');
  return (
    <p>
      {players.data?.players.length ?? 0} players, {groups.data?.groups.length ?? 0} groups,{' '}
      {family.family?.name}
    </p>
  );
};

describe('who is in the circle, as an admin changes it', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("a player's change asks again for the groups, the family, and Home's members", async () => {
    const fetch = fakeApi({
      'GET /admin/players': () => ({
        players: [{ userId: 'bob', group: 'smiths', color: '#000' }],
        success: true,
      }),
      'GET /admin/groups': () => ({ groups: [], sides: {}, success: true }),
      'GET /family': () => ({ family: exampleFamily, photoUrls: {} }),
      'PUT /admin/players': () => ({ success: true }),
      'DELETE /admin/groups': () => ({ success: true }),
    });
    const refreshInit = vi.fn(async () => undefined);
    openTabIn('home');
    const view = renderWithServerData(
      <FamilyDataContext.Provider value={{ refreshInit } as never}>
        <People />
      </FamilyDataContext.Provider>,
    );
    await vi.waitFor(() =>
      expect(view.container.textContent).toBe('1 players, 0 groups, The Example Family'),
    );

    await act(async () => {
      await move();
    });
    expect(gets(fetch, '/admin/players')).toBe(2);
    expect(gets(fetch, '/admin/groups')).toBe(2);
    expect(gets(fetch, '/family')).toBe(2);
    expect(refreshInit).toHaveBeenCalledTimes(1);

    // A group's change leaves the players and the family alone.
    await act(async () => {
      await removeGroup();
    });
    expect(gets(fetch, '/admin/groups')).toBe(3);
    expect(gets(fetch, '/admin/players')).toBe(2);
    expect(gets(fetch, '/family')).toBe(2);
    view.unmount();
  });
});
