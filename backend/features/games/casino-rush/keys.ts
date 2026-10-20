/**
 * Where Casino Rush keeps its files. These keys are stored data: they never
 * change (keys.test.ts holds them to the strings they have always been).
 */

/** Every Casino Rush key starts here, then the player's id. */
export const STORAGE = 'casino-rush/';

const mine = (userId: string) => `${STORAGE}${userId}/`;

export const keys = {
  /** The play under way. Removed when it ends: its answers go to the answer history. */
  current: (userId: string) => `${mine(userId)}current-session.json`,
  /** The one session file used before current-session.json. */
  legacy: (userId: string) => `${mine(userId)}session.json`,
  /** Finished plays kept from before the answer history held them. */
  sessions: (userId: string) => `${mine(userId)}sessions/`,
  /** Last-played times kept from before the cooldown came from the answer history. */
  history: (userId: string) => `${mine(userId)}history.json`,
};
