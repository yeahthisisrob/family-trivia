/** Season information */
export interface Season {
  seasonNumber: number;
  name: string;
  status: 'active' | 'concluded' | 'upcoming';
  startDate: string;
  endDate: string | null;
  message: string | null;
}

/** End of season status */
export interface EndOfSeasonStatus {
  isEndOfSeason: boolean;
  isBetweenSeasons: boolean;
  currentSeason: Season | null;
  lastSeason: Season | null;
  personalMessage: string | null;
  seasonEndDate: string | null;
  nextSeasonStart: string | null;
}
