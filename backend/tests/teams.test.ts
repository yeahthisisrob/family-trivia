vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import {
  answerRequest,
  askToJoin,
  askToTeamUp,
  leaveTeam,
  startTeam,
  viewTeams,
} from '../features/teams/service';
import { invalidateSeasonsCache } from '../services/seasonService';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const today = new Date().toISOString().slice(0, 10);

function seed(play: 'solo' | 'teams' = 'teams') {
  resetS3Mock();
  invalidateSeasonsCache();
  seedRaw('config/seasons.json', {
    currentSeasonNumber: 1,
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        status: 'active',
        startDate: '2026-01-01',
        endDate: null,
        message: null,
        play,
      },
    ],
  });
  seedRaw('family/family.json', {
    version: 2,
    name: 'The Crew',
    people: Object.fromEntries(
      ['alice', 'bob', 'carol', 'dave'].map((id) => [
        id,
        { id, name: id[0]?.toUpperCase() + id.slice(1), participation: 'playing' },
      ]),
    ),
    ties: [],
    households: {},
  });
  seedRaw('answers/history/alice.json', [
    {
      question: 'q',
      correct: true,
      pointsEarned: 30,
      timestamp: `${today}T12:00:00Z`,
      difficulty: 'normal',
      category: 'x',
    },
  ]);
}

describe('teams', () => {
  test('a solo season has no teams to make', async () => {
    seed('solo');
    expect((await viewTeams('alice')).on).toBe(false);
    expect(await startTeam('alice', 'Quizzards')).toMatchObject({ ok: false, status: 409 });
  });

  test('start a team, ask to join, a member says yes; requests settle', async () => {
    seed();
    expect((await startTeam('alice', 'Quizzards')).ok).toBe(true);
    const team = (await viewTeams('alice')).teams[0];
    expect(team).toMatchObject({ name: 'Quizzards', members: ['alice'] });

    expect((await askToJoin('bob', team?.id as string)).ok).toBe(true);
    // Bob also asked Carol to team up; joining a team takes that back.
    await askToTeamUp('bob', 'carol');
    const waiting = (await viewTeams('alice')).toMe;
    expect(waiting).toHaveLength(1);
    expect((await answerRequest('alice', waiting[0]?.id as string, true)).ok).toBe(true);

    const after = await viewTeams('carol');
    expect(after.teams[0]?.members).toEqual(['alice', 'bob']);
    expect(after.toMe).toEqual([]);
    // Ranked by points per member: Alice's 30 shared by two.
    expect(after.standings[0]).toMatchObject({ name: 'Quizzards', average: 15 });
  });

  test('team up with someone on their own; only they can say yes', async () => {
    seed();
    await askToTeamUp('carol', 'dave');
    const req = (await viewTeams('dave')).toMe[0];
    expect(await answerRequest('alice', req?.id as string, true)).toMatchObject({ ok: false });
    expect((await answerRequest('dave', req?.id as string, true)).ok).toBe(true);
    expect((await viewTeams('dave')).teams[0]).toMatchObject({ name: 'Carol & Dave' });
  });

  test('leaving the last seat lets the team go', async () => {
    seed();
    await startTeam('alice', 'Solo act');
    expect((await leaveTeam('alice')).ok).toBe(true);
    expect((await viewTeams('alice')).teams).toEqual([]);
  });
});
