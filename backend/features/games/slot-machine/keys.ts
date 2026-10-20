/**
 * Where the Slot Machine keeps its files. These keys are stored data: they
 * never change (keys.test.ts holds them to the strings they have always been).
 */

/** Every Slot Machine key starts here, then the player's id. */
export const STORAGE = 'slot-machine/';

const mine = (userId: string) => `${STORAGE}${userId}/`;

export const keys = {
  /** The latest spin and its question. */
  session: (userId: string) => `${mine(userId)}session.json`,
  /** Plays, wins and streaks. */
  stats: (userId: string) => `${mine(userId)}stats.json`,
  /** A finished play, kept for the timeline. */
  finished: (userId: string, startTime: number, won: boolean) =>
    `${mine(userId)}sessions/${startTime}_${won ? 'won' : 'lost'}.json`,
};
