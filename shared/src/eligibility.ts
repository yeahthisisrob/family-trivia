/** Why a user cannot play right now */
export type IneligibilityReason =
  | 'daily_limit_reached'
  | 'no_catchup_available'
  | 'end_of_season';

/** What game mode the eligibility check is for */
export type PlayMode = 'regular' | 'catchup' | 'casino-rush' | 'slot-machine' | 'curling' | 'tetris';

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
