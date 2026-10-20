/**
 * Who is in the circle as an admin edits it, as server data
 * (docs/decisions/0035): the players (the user config), the groups and the
 * family tree's root partners and sides. A change asks again for each read
 * that shows it, here and elsewhere: the family and its graph, the results
 * (groups, colours), the timeline's sides, and the members, groups and sides
 * that /app-init carries.
 */
import { useRefreshAppInit } from '../../../contexts/FamilyDataContext';
import { FAMILY, GRAPH } from '../../../entities/family';
import { LEADERBOARD } from '../../../entities/leaderboard';
import { TIMELINE } from '../../../entities/timeline';
import { type BodyOf, callApi, type ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { loadSession } from '../../../shared/session/session';

const ADMIN_PLAYERS = ['admin', 'players'] as const;
const ADMIN_GROUPS = ['admin', 'groups'] as const;
const ADMIN_TREE = ['admin', 'family-tree'] as const;

export type AdminPlayer = ResponseOf<'/admin/players'>['players'][number];
type AdminGroups = ResponseOf<'/admin/groups'>;
export type AdminGroup = AdminGroups['groups'][number];
export type FamilyTree = ResponseOf<'/admin/family-tree'>;
export type Side = FamilyTree['sides'][string];
export type RootPartner = FamilyTree['rootPartners'][number];

type Without<P extends '/admin/players' | '/admin/groups', M extends 'post' | 'put'> = Omit<
  BodyOf<P, M>,
  'adminUserId'
>;
export type NewPlayer = Without<'/admin/players', 'post'>;
export type PlayerChange = Without<'/admin/players', 'put'>;
export type NewGroup = Without<'/admin/groups', 'post'>;
export type GroupChange = Without<'/admin/groups', 'put'>;
type TreeChange = Omit<BodyOf<'/admin/family-tree', 'put'>, 'adminUserId'>;

const adminUserId = () => loadSession() ?? '';
const asAdmin = () => ({ adminUserId: adminUserId() });

export const useAdminPlayers = () =>
  useCircleQuery({ key: ADMIN_PLAYERS, path: '/admin/players', query: asAdmin() });

export const useAdminGroups = () =>
  useCircleQuery({ key: ADMIN_GROUPS, path: '/admin/groups', query: asAdmin() });

export const useFamilyTree = () =>
  useCircleQuery({ key: ADMIN_TREE, path: '/admin/family-tree', query: asAdmin() });

/** A player's change shows in the groups (members), the family, the results and Home. */
const A_PLAYER = [ADMIN_PLAYERS, ADMIN_GROUPS, FAMILY, GRAPH, LEADERBOARD];
/** A group's change shows in the sides (their groups), the results and Home. */
const A_GROUP = [ADMIN_GROUPS, ADMIN_TREE, LEADERBOARD];
/** The sides show in the groups and the timeline. */
const THE_TREE = [ADMIN_TREE, ADMIN_GROUPS, TIMELINE];

/**
 * One change to who is in the circle. It never retries and changes nothing
 * on screen before the server says it's saved; then the reads it names, and
 * /app-init (until step 5), are asked again.
 */
function usePeopleChange<V>(
  send: (vars: V) => Promise<unknown>,
  invalidates: readonly (readonly string[])[],
) {
  const refreshAppInit = useRefreshAppInit();
  return useCircleMutation({
    mutationFn: send,
    invalidates,
    onSuccess: () => void refreshAppInit(),
  });
}

export const useAddPlayer = () =>
  usePeopleChange(
    (player: NewPlayer) =>
      callApi('/admin/players', { method: 'post', once: true, body: { ...asAdmin(), ...player } }),
    A_PLAYER,
  );

export const useUpdatePlayer = () =>
  usePeopleChange(
    (change: PlayerChange) =>
      callApi('/admin/players', { method: 'put', once: true, body: { ...asAdmin(), ...change } }),
    A_PLAYER,
  );

export const useDeletePlayer = () =>
  usePeopleChange(
    (userId: string) =>
      callApi('/admin/players', { method: 'delete', once: true, body: { ...asAdmin(), userId } }),
    A_PLAYER,
  );

export const useAddGroup = () =>
  usePeopleChange(
    (group: NewGroup) =>
      callApi('/admin/groups', { method: 'post', once: true, body: { ...asAdmin(), ...group } }),
    A_GROUP,
  );

export const useUpdateGroup = () =>
  usePeopleChange(
    (change: GroupChange) =>
      callApi('/admin/groups', { method: 'put', once: true, body: { ...asAdmin(), ...change } }),
    A_GROUP,
  );

export const useDeleteGroup = () =>
  usePeopleChange(
    (groupId: string) =>
      callApi('/admin/groups', { method: 'delete', once: true, body: { ...asAdmin(), groupId } }),
    A_GROUP,
  );

export const useSaveFamilyTree = () =>
  usePeopleChange(
    (tree: TreeChange) =>
      callApi('/admin/family-tree', { method: 'put', once: true, body: { ...asAdmin(), ...tree } }),
    THE_TREE,
  );
