/** Why a user cannot play right now */
export type IneligibilityReason =
  | 'daily_limit_reached'
  | 'no_catchup_available'
  | 'end_of_season'
  /** A facts-only season: the season runs, but asks no trivia. */
  | 'no_trivia_this_season';

/** What to tell someone who can't play, by reason. */
export const INELIGIBLE_MESSAGE: Record<IneligibilityReason, string> = {
  daily_limit_reached: 'Daily question limit reached',
  no_catchup_available: 'No catch-up questions available',
  end_of_season: 'Season has ended',
  no_trivia_this_season: 'No trivia this season',
};

/** What game mode the eligibility check is for */
export type PlayMode =
  | 'regular'
  | 'catchup'
  | 'casino-rush'
  | 'slot-machine'
  | 'curling'
  | 'tetris';

/** Result of an eligibility check — single source of truth for "can this user play?" */
export interface PlayEligibility {
  canPlay: boolean;
  reason?: IneligibilityReason;
  /** ISO timestamp of when the user can next play (null if canPlay is true) */
  nextAvailableAt?: string | null;
  /** Today's date in Eastern Time (YYYY-MM-DD) */
  todayET: string;
  /** How many catch-up questions the user is behind */
  catchupAvailable: number;
  /** ISO timestamp of the user's last answer */
  lastAnsweredAt: string | null;
}
