/**
 * The results (the leaderboard), as server data (docs/decisions/0035): every
 * player's points and each group's totals, for a season or all time, in one
 * request. Everyone with results keeps a row, remembered and paused people
 * included (#118): nothing here filters by who is playing now.
 */
import type { ResponseOf } from '../../../shared/api/contract';
import { useCircleQuery } from '../../../shared/api/query';

type Answer = ResponseOf<'/consolidated-leaderboard'>;
export type PlayerResult = Answer['users'][string]['leaderboardEntry'];
export type GroupResult = Answer['groups'][string];
type ResultsSeason = Answer['seasons'][number];
type CategoryStats = NonNullable<Answer['globalCategoryStats']>;

/** A trivia answer, a game's score or a round changes them. */
export const LEADERBOARD = ['leaderboard'] as const;

/**
 * Which results: a season's, all time, or `current` (the active season, else
 * the latest one that ended): what the leaderboard opens on.
 */
export type SeasonChoice = number | 'all' | 'current';

interface Results {
  /** Best first. */
  players: PlayerResult[];
  /** Groups with members, best first. */
  groups: GroupResult[];
  userGroups: Record<string, string>;
  seasons: ResultsSeason[];
  /** The season shown; undefined for all time. */
  selectedSeason?: number;
  maxQuestionsAsked?: number;
}

const toResults = (answer: Answer): Results => ({
  players: Object.values(answer.users)
    .map((user) => user.leaderboardEntry)
    .sort((a, b) => b.score - a.score),
  groups: Object.values(answer.groups)
    .filter((group) => group.memberCount > 0)
    .sort((a, b) => b.totalScore - a.totalScore),
  userGroups: answer.userGroups,
  seasons: answer.seasons,
  selectedSeason: answer.selectedSeason,
  maxQuestionsAsked: answer.maxQuestionsAsked,
});

const ask = (season: SeasonChoice) =>
  ({
    key: LEADERBOARD,
    path: '/consolidated-leaderboard',
    query: season === 'all' ? undefined : { season },
  }) as const;

export const useResults = (season: SeasonChoice) =>
  useCircleQuery({ ...ask(season), select: toResults });

const categoryStats = (answer: Answer): CategoryStats => answer.globalCategoryStats ?? {};

/**
 * How often each category is answered right, all time. Every answer carries
 * it; this reads the one the leaderboard opens on, so the two share a request.
 */
export const useCategoryStats = () => useCircleQuery({ ...ask('current'), select: categoryStats });
