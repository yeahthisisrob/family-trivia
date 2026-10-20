/**
 * Teams (docs/decisions/0030): a season can be played as teams. People make
 * them as they play, not in an editor: start one, ask someone to team up, or
 * ask to join one, and a member says yes. Mid-season is fine; nothing expires.
 */

export const TEAM_MAX = 6;

export interface Team {
  id: string;
  name: string;
  members: string[];
  createdAt: string;
}

/** "Can I join your team?" (to a team) or "Team up with me?" (to a person on their own). */
export type TeamRequest =
  | { id: string; kind: 'join'; from: string; teamId: string; at: string }
  | { id: string; kind: 'team-up'; from: string; to: string; at: string };

/** As stored for a season: seasons/{n}/teams.json */
export interface SeasonTeams {
  teams: Team[];
  requests: TeamRequest[];
}

export interface TeamStanding {
  teamId: string;
  name: string;
  members: string[];
  /** Points per member, so a small team can win. */
  average: number;
  total: number;
}

/** What one person sees. */
export interface TeamsView {
  on: boolean;
  teams: Team[];
  myTeam: string | null;
  /** Requests waiting for me (to my team, or to me), and the ones I sent. */
  toMe: TeamRequest[];
  fromMe: TeamRequest[];
  standings: TeamStanding[];
}

export const teamOf = (t: SeasonTeams, userId: string) =>
  t.teams.find((x) => x.members.includes(userId)) ?? null;

/** Teams ranked by points per member, then total. */
export function teamStandings(teams: Team[], points: Record<string, number>): TeamStanding[] {
  return teams
    .filter((t) => t.members.length)
    .map((t) => {
      const total = t.members.reduce((n, m) => n + (points[m] ?? 0), 0);
      return {
        teamId: t.id,
        name: t.name,
        members: t.members,
        total,
        average: Math.round((total / t.members.length) * 10) / 10,
      };
    })
    .sort((a, b) => b.average - a.average || b.total - a.total || a.name.localeCompare(b.name));
}
