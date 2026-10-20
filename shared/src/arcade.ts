/**
 * Arcade types — shared between frontend and backend.
 * Unified high score system for all game modes (trivia + arcade plays).
 */

/**
 * A game's id: its folder name in frontend/src/games (docs/decisions/0032),
 * lowercase words joined by dashes. Any id works; nothing lists them.
 */
export type ArcadeGameId = string;

/** A clue with a one-word answer, from the circle's trivia or its answers. */
export interface GameClue {
  clue: string;
  /** Uppercase letters only. */
  answer: string;
  from: 'trivia' | 'answers';
  /** Whose answer it was, for clues from answers. */
  about?: string;
}

export interface HighScoreEntry {
  userId: string;
  score: number;
  date: string;
  /** Where this score came from */
  mode: 'trivia' | 'arcade';
}

export interface ScoreSubmitResult {
  isNewHighScore: boolean;
  rank: number;
  previousBest: number;
  highScores: HighScoreEntry[];
}

export interface ArcadeLeaderboard {
  game: ArcadeGameId;
  scores: HighScoreEntry[];
}
