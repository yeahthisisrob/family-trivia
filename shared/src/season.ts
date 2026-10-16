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
}

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
