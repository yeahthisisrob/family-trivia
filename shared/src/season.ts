/**
 * Seasons: the switch for what the family is asked. Between seasons nothing
 * new is asked; the app is a place to look back. Each season can carry a
 * letter for its start and its end (Markdown and an optional photo).
 */
export type SeasonStatus = 'active' | 'concluded' | 'upcoming';

export interface SeasonNote {
  /** Replaces "<season> begins" / "<season> has ended", e.g. "In memory of…". */
  title?: string;
  markdown: string;
  /** Key of an image under media/ in the family's data bucket. */
  image?: string;
}

/**
 * What a season's trivia is about: general knowledge, the family itself
 * (questions written from the family's own answers), both, or none at all
 * (a facts-only season: the daily family questions carry on, no trivia).
 */
export type SeasonTrivia = 'general' | 'family' | 'mixed' | 'off';

export const SEASON_TRIVIA: readonly { id: SeasonTrivia; label: string; help: string }[] = [
  {
    id: 'general',
    label: 'General trivia',
    help: 'Questions from the categories, about the world.',
  },
  {
    id: 'family',
    label: 'Our family',
    help: 'Every question is about us, written from our own answers.',
  },
  { id: 'mixed', label: 'Both', help: 'The categories, plus Our Family as one of them.' },
  {
    id: 'off',
    label: 'No trivia',
    help: 'Just the daily questions about us. Nothing to score.',
  },
];

/** Whether this season asks trivia at all. */
export const hasTrivia = (s: Pick<Season, 'trivia'> | null | undefined): boolean =>
  seasonTriviaOf(s) !== 'off';

export const isSeasonTrivia = (v: unknown): v is SeasonTrivia =>
  typeof v === 'string' && SEASON_TRIVIA.some((t) => t.id === v);

/** Seasons from before this setting play general trivia. */
export const seasonTriviaOf = (s: Pick<Season, 'trivia'> | null | undefined): SeasonTrivia =>
  s?.trivia ?? 'general';

export interface Season {
  seasonNumber: number;
  name: string;
  status: SeasonStatus;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, or null while the season is running */
  endDate: string | null;
  /** Legacy plain-text end message; `notes.end` replaces it. */
  message: string | null;
  notes?: { start?: SeasonNote; end?: SeasonNote };
  /** What the trivia is about this season; general when unset. */
  trivia?: SeasonTrivia;
  /** Each for themselves, or teams (docs/decisions/0030); solo when unset. */
  play?: SeasonPlay;
  /** Daily, or weekly: a handful once a week (docs/decisions/0016); daily when unset. */
  pace?: SeasonPace;
  /** Trivia questions a week in a weekly season. */
  perWeek?: number;
}

// ── Pace: what "today" means in a season (docs/decisions/0016) ──────────

export type SeasonPace = 'daily' | 'weekly';
export const isSeasonPace = (v: unknown): v is SeasonPace => v === 'daily' || v === 'weekly';
export const PER_WEEK = 5;

export const paceOf = (s: Pick<Season, 'pace'> | null | undefined): SeasonPace =>
  s?.pace ?? 'daily';

/** Trivia questions per play period: one a day, or the week's handful. */
export const perPeriod = (s: Pick<Season, 'pace' | 'perWeek'> | null | undefined): number =>
  paceOf(s) === 'weekly' ? Math.max(1, Math.min(14, s?.perWeek ?? PER_WEEK)) : 1;

const DAY = 86_400_000;
const at = (d: string) => Date.parse(`${d}T12:00:00Z`);

/**
 * The play period a day (YYYY-MM-DD) belongs to, as its first day: the day
 * itself in a daily season, that week's Monday in a weekly one.
 */
export function playPeriod(day: string, pace: SeasonPace): string {
  if (pace === 'daily') return day;
  const t = at(day);
  const fromMonday = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - fromMonday * DAY).toISOString().slice(0, 10);
}

/** Whole periods from the one holding `from` up to (not including) the one holding `to`. */
export function periodsBetween(from: string, to: string, pace: SeasonPace): number {
  const days = Math.round((at(playPeriod(to, pace)) - at(playPeriod(from, pace))) / DAY);
  return Math.max(0, pace === 'weekly' ? Math.round(days / 7) : days);
}

export type SeasonPlay = 'solo' | 'teams';
export const isSeasonPlay = (v: unknown): v is SeasonPlay => v === 'solo' || v === 'teams';

export interface SeasonsConfig {
  /** null between seasons */
  currentSeasonNumber: number | null;
  seasons: Season[];
}

/** A season letter ready to show: the photo as a short-lived URL. */
export interface SeasonLetter {
  seasonNumber: number;
  kind: 'start' | 'end';
  title?: string;
  markdown: string;
  imageUrl?: string;
}

/** Season status as the app sees it. */
export interface EndOfSeasonStatus {
  /** true when no season is running */
  isEndOfSeason: boolean;
  /** true when the last season concluded and no new one has started */
  isBetweenSeasons: boolean;
  currentSeason: Season | null;
  lastSeason: Season | null;
  personalMessage: string | null;
  seasonEndDate: string | null;
  nextSeasonStart: string | null;
  /** The letter this person hasn't read yet: the end letter between seasons, the start letter during one. */
  letter: SeasonLetter | null;
}
