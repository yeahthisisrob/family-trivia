/**
 * Arcade types — shared between frontend and backend.
 * Unified high score system for all game modes (trivia + arcade plays).
 */

export type ArcadeGameId = 'tetris' | 'curling' | 'slot-machine' | 'crossword' | 'snake' | 'blackjack' | 'casino';

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
