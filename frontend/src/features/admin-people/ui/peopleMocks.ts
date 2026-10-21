/** What Admin › Players, Groups and Family Tree read, as MSW answers for their stories. */
import { HttpResponse, http } from 'msw';
import { colors } from '../../../shared/design-system';

const PLAYERS = [
  { userId: 'alice', group: 'parents', color: colors.user[1], isAdmin: true },
  { userId: 'bob', group: 'parents', color: colors.user[2] },
  { userId: 'charlie', group: 'kids', color: colors.user[0] },
  // Added before there were groups.
  { userId: 'dana', group: '', color: colors.user[3] },
];

const SIDES = {
  springfield: {
    id: 'springfield',
    name: 'Springfield',
    color: colors.user[2],
    groups: ['parents'],
  },
  shelbyville: { id: 'shelbyville', name: 'Shelbyville', color: colors.user[4], groups: ['kids'] },
};

const GROUPS = [
  {
    groupId: 'parents',
    name: 'Parents',
    memberCount: 2,
    members: ['alice', 'bob'],
    side: 'springfield',
    description: 'The grown-ups',
  },
  {
    groupId: 'kids',
    name: 'Kids',
    memberCount: 1,
    members: ['charlie'],
    side: 'shelbyville',
    description: null,
  },
];

const answer = (data: unknown) => HttpResponse.json({ ok: true, data });

export const peopleHandlers = ({ empty = false } = {}) => [
  http.get('*/admin/players', () => answer({ players: empty ? [] : PLAYERS, success: true })),
  http.get('*/admin/groups', () =>
    answer({ groups: empty ? [] : GROUPS, sides: empty ? {} : SIDES, success: true }),
  ),
  http.get('*/admin/family-tree', () =>
    answer({
      rootPartners: empty
        ? []
        : [
            { id: 'alice', name: 'Alice', role: 'grandmother' },
            { id: 'bob', name: 'Bob', role: 'grandfather' },
          ],
      sides: empty ? {} : SIDES,
      success: true,
    }),
  ),
];
