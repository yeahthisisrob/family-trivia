/**
 * Teams (docs/decisions/0030), per season at seasons/{n}/teams.json. People
 * form them as they play; a request waits until someone it's for says yes.
 */
import { randomBytes } from 'node:crypto';
import {
  isPlaying,
  type SeasonTeams,
  TEAM_MAX,
  type TeamsView,
  teamOf,
  teamStandings,
} from '@family-trivia/shared';
import { loadJoined } from '../../services/family/joined';
import { getAllPlayerState } from '../../services/playerStateService';
import { getJson, putJson } from '../../services/s3';
import { computePoints } from '../../services/scoring';
import { getCurrentSeason } from '../../services/seasonService';

const KEY = (season: number) => `seasons/${season}/teams.json`;
const newId = () => randomBytes(6).toString('base64url');

/** The season being played as teams, or null. */
async function teamSeason() {
  const s = await getCurrentSeason();
  return s?.play === 'teams' ? s : null;
}

const load = async (n: number): Promise<SeasonTeams> =>
  (await getJson<SeasonTeams>(KEY(n))) ?? { teams: [], requests: [] };

async function players(): Promise<Map<string, string>> {
  const { visible } = await loadJoined();
  return new Map(
    Object.values(visible.people)
      .filter(isPlaying)
      .map((p) => [p.id, p.name]),
  );
}

/** Points this season, per person: what the standings add up. */
async function seasonPoints(start: string, end: string | null) {
  const states = await getAllPlayerState();
  const points: Record<string, number> = {};
  for (const [id, st] of states) {
    points[id] = st.history
      .filter((h) => {
        const d = h.timestamp?.slice(0, 10) ?? '';
        return h.correct && d >= start && (!end || d <= end);
      })
      .reduce((n, h) => n + computePoints(h), 0);
  }
  return points;
}

export async function viewTeams(me: string): Promise<TeamsView> {
  const season = await teamSeason();
  if (!season) return { on: false, teams: [], myTeam: null, toMe: [], fromMe: [], standings: [] };
  const t = await load(season.seasonNumber);
  const mine = teamOf(t, me);
  return {
    on: true,
    teams: t.teams,
    myTeam: mine?.id ?? null,
    toMe: t.requests.filter((r) => (r.kind === 'join' ? r.teamId === mine?.id : r.to === me)),
    fromMe: t.requests.filter((r) => r.from === me),
    standings: teamStandings(t.teams, await seasonPoints(season.startDate, season.endDate)),
  };
}

export type TeamResult = { ok: true } | { ok: false; status: 400 | 404 | 409; error: string };
const no = (status: 400 | 404 | 409, error: string): TeamResult => ({ ok: false, status, error });

/** Change this season's teams, if it's played as teams. */
async function change(fn: (t: SeasonTeams, names: Map<string, string>) => TeamResult) {
  const season = await teamSeason();
  if (!season) return no(409, 'This season isn’t played in teams');
  const [t, names] = await Promise.all([load(season.seasonNumber), players()]);
  const r = fn(t, names);
  if (r.ok) await putJson(KEY(season.seasonNumber), t);
  return r;
}

/** Someone who joins a team has no more requests out, or waiting to be answered for them. */
const settle = (t: SeasonTeams, ids: string[]) => {
  t.requests = t.requests.filter(
    (r) => !ids.includes(r.from) && !(r.kind === 'team-up' && ids.includes(r.to)),
  );
};

export const startTeam = (me: string, name: string) =>
  change((t, names) => {
    if (!names.has(me)) return no(404, 'You’re not playing this season');
    if (teamOf(t, me)) return no(409, 'You’re already on a team');
    const clean = name.trim().slice(0, 40);
    if (!clean) return no(400, 'A team needs a name');
    t.teams.push({ id: newId(), name: clean, members: [me], createdAt: new Date().toISOString() });
    settle(t, [me]);
    return { ok: true };
  });

export const askToJoin = (me: string, teamId: string) =>
  change((t, names) => {
    const team = t.teams.find((x) => x.id === teamId);
    if (!team || !names.has(me)) return no(404, 'No such team');
    if (teamOf(t, me)) return no(409, 'You’re already on a team');
    if (team.members.length >= TEAM_MAX) return no(409, 'That team is full');
    if (t.requests.some((r) => r.from === me && r.kind === 'join' && r.teamId === teamId))
      return { ok: true };
    t.requests.push({ id: newId(), kind: 'join', from: me, teamId, at: new Date().toISOString() });
    return { ok: true };
  });

export const askToTeamUp = (me: string, to: string) =>
  change((t, names) => {
    if (!names.has(me) || !names.has(to) || me === to) return no(404, 'They’re not playing');
    if (teamOf(t, me) || teamOf(t, to)) return no(409, 'One of you is already on a team');
    if (t.requests.some((r) => r.kind === 'team-up' && r.from === me && r.to === to))
      return { ok: true };
    t.requests.push({ id: newId(), kind: 'team-up', from: me, to, at: new Date().toISOString() });
    return { ok: true };
  });

export const answerRequest = (me: string, requestId: string, accept: boolean) =>
  change((t, names) => {
    const r = t.requests.find((x) => x.id === requestId);
    if (!r) return no(404, 'That request has gone');
    const mine = teamOf(t, me);
    const forMe = r.kind === 'join' ? r.teamId === mine?.id : r.to === me;
    if (!forMe) return no(404, 'That request isn’t for you');
    t.requests = t.requests.filter((x) => x.id !== requestId);
    if (!accept) return { ok: true };
    if (teamOf(t, r.from)) return { ok: true }; // they found a team meanwhile
    if (r.kind === 'join') {
      const team = t.teams.find((x) => x.id === r.teamId);
      if (!team || team.members.length >= TEAM_MAX) return no(409, 'That team is full');
      team.members.push(r.from);
      settle(t, [r.from]);
    } else {
      if (mine) return no(409, 'You’re already on a team');
      t.teams.push({
        id: newId(),
        name: `${names.get(r.from) ?? r.from} & ${names.get(me) ?? me}`,
        members: [r.from, me],
        createdAt: new Date().toISOString(),
      });
      settle(t, [r.from, me]);
    }
    return { ok: true };
  });

export const leaveTeam = (me: string) =>
  change((t) => {
    const team = teamOf(t, me);
    if (!team) return { ok: true };
    team.members = team.members.filter((m) => m !== me);
    // An empty team goes, and so do requests to join it.
    if (!team.members.length) {
      t.teams = t.teams.filter((x) => x.id !== team.id);
      t.requests = t.requests.filter((r) => !(r.kind === 'join' && r.teamId === team.id));
    }
    return { ok: true };
  });
