// File: lambda/services/familyFeudService.ts
// Purpose: Family Feud round-robin game mode.
// One person per round answers a personal question, everyone else guesses.
// Rounds last 2 days, then points are awarded and rotation advances.

import { getJson, putJson, listObjects, deleteObject, fileExists } from './s3';
import { logger } from './logger';
import { getEasternDateString } from '@family-trivia/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FamilyFeudRound {
  roundId: string;              // e.g. "2026-03-28_rob"
  targetUserId: string;         // Who the question is about
  targetUserName: string;
  question: string;             // AI-generated personal question
  realAnswer: string | null;    // Target's actual answer (null until they respond)
  choices: string[] | null;     // AI-generated multiple choice options (null until target answers)
  answeredAt: string | null;    // When target answered
  startedAt: string;            // ISO date when round was created
  expiresAt: string;            // ISO date when guessing closes (startedAt + 2 days)
  status: 'waiting_for_target' | 'active' | 'completed';
  guesses: Record<string, FamilyFeudGuess>;
  results?: FamilyFeudResults;
}

export interface FamilyFeudGuess {
  userId: string;
  userName: string;
  guess: string;
  submittedAt: string;
}

export interface FamilyFeudResults {
  winners: Array<{ userId: string; userName: string; points: number }>;
  totalGuesses: number;
  revealedAt: string;
}

export interface FamilyFeudRotation {
  allUserIds: string[];
  currentIndex: number;         // Legacy — no longer used for selection
  roundHistory: Array<{
    userId: string;
    roundId: string;
    date: string;
    passed: boolean;
  }>;
  passedUsers: string[];
}

// ---------------------------------------------------------------------------
// S3 Paths
// ---------------------------------------------------------------------------

const FEUD_CURRENT = 'family-feud/current-round.json';
const FEUD_ROTATION = 'family-feud/rotation.json';
const FEUD_ROUND = (roundId: string) => `family-feud/rounds/${roundId}.json`;
const FEUD_ROUNDS_DIR = 'family-feud/rounds/';

// ---------------------------------------------------------------------------
// Rotation Management
// ---------------------------------------------------------------------------

/**
 * Get or initialize the rotation state.
 * Takes all user IDs from hierarchy so we have a consistent order.
 */
export async function getRotation(allUserIds: string[]): Promise<FamilyFeudRotation> {
  const existing = await getJson<FamilyFeudRotation>(FEUD_ROTATION);
  if (existing && existing.allUserIds.length > 0) {
    // Sync new users into rotation (if family grew)
    const existingSet = new Set(existing.allUserIds);
    for (const uid of allUserIds) {
      if (!existingSet.has(uid)) {
        existing.allUserIds.push(uid);
      }
    }
    return existing;
  }

  // Initialize fresh rotation
  const rotation: FamilyFeudRotation = {
    allUserIds: [...allUserIds],
    currentIndex: 0,
    roundHistory: [],
    passedUsers: [],
  };
  await putJson(FEUD_ROTATION, rotation);
  return rotation;
}

/**
 * Pick a random next person, weighted toward those who haven't gone yet.
 * Skips passed users.
 */
export async function advanceRotation(rotation: FamilyFeudRotation): Promise<string> {
  const counts = getTargetCounts(rotation);
  const eligible = rotation.allUserIds.filter(id => !rotation.passedUsers.includes(id));

  if (eligible.length === 0) {
    // Everyone passed — reset and pick random
    rotation.passedUsers = [];
    const idx = Math.floor(Math.random() * rotation.allUserIds.length);
    rotation.currentIndex = idx;
    await putJson(FEUD_ROTATION, rotation);
    return rotation.allUserIds[idx];
  }

  // Weight: people who haven't gone get highest weight
  const minCount = Math.min(...eligible.map(id => counts[id] || 0));
  const neverGone = eligible.filter(id => (counts[id] || 0) === minCount);

  // Pick randomly from those with fewest turns (or never gone)
  const pool = neverGone.length > 0 ? neverGone : eligible;
  const picked = pool[Math.floor(Math.random() * pool.length)];

  rotation.currentIndex = rotation.allUserIds.indexOf(picked);
  await putJson(FEUD_ROTATION, rotation);
  return picked;
}

/**
 * Get count of times each user has been the target.
 */
function getTargetCounts(rotation: FamilyFeudRotation): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of rotation.roundHistory) {
    if (!entry.passed) {
      counts[entry.userId] = (counts[entry.userId] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Get stats about who hasn't gone yet.
 */
export function getRotationStats(rotation: FamilyFeudRotation): {
  totalPeople: number;
  neverGone: string[];
  timesPerPerson: Record<string, number>;
} {
  const counts = getTargetCounts(rotation);
  const neverGone = rotation.allUserIds.filter(id => !counts[id]);
  return {
    totalPeople: rotation.allUserIds.length,
    neverGone,
    timesPerPerson: counts,
  };
}

/**
 * Get how many times a user has been "it".
 */
export function getTimesAsTarget(rotation: FamilyFeudRotation, userId: string): number {
  return rotation.roundHistory.filter(r => r.userId === userId && !r.passed).length;
}

// ---------------------------------------------------------------------------
// Round Management
// ---------------------------------------------------------------------------

/**
 * Get the current active round (if any).
 */
export async function getCurrentRound(): Promise<FamilyFeudRound | null> {
  try {
    const round = await getJson<FamilyFeudRound>(FEUD_CURRENT);
    // Guard against stored "null" or incomplete data
    if (!round || !round.roundId) return null;
    return round;
  } catch {
    return null;
  }
}

/**
 * Create a new round for the target user.
 */
export async function createRound(
  targetUserId: string,
  targetUserName: string,
  question: string,
): Promise<FamilyFeudRound> {
  const now = new Date();
  const roundId = `${getEasternDateString()}_${targetUserId}`;
  const expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000); // +2 days

  const round: FamilyFeudRound = {
    roundId,
    targetUserId,
    targetUserName,
    question,
    realAnswer: null,
    choices: null,
    answeredAt: null,
    startedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'waiting_for_target',
    guesses: {},
  };

  await putJson(FEUD_CURRENT, round);
  await putJson(FEUD_ROUND(roundId), round);

  logger.info('Created Family Feud round', { roundId, targetUserId, question });
  return round;
}

/**
 * Target user submits their real answer — activates the round for guessing.
 */
export async function submitTargetAnswer(
  round: FamilyFeudRound,
  answer: string,
  choices: string[],
): Promise<FamilyFeudRound> {
  round.realAnswer = answer;
  round.choices = choices;
  round.answeredAt = new Date().toISOString();
  round.status = 'active';

  await putJson(FEUD_CURRENT, round);
  await putJson(FEUD_ROUND(round.roundId), round);

  logger.info('Target answered Family Feud', {
    roundId: round.roundId,
    targetUserId: round.targetUserId,
  });
  return round;
}

/**
 * Submit a guess for the current round.
 */
export async function submitGuess(
  round: FamilyFeudRound,
  userId: string,
  userName: string,
  guess: string,
): Promise<FamilyFeudRound> {
  round.guesses[userId] = {
    userId,
    userName,
    guess,
    submittedAt: new Date().toISOString(),
  };

  await putJson(FEUD_CURRENT, round);
  await putJson(FEUD_ROUND(round.roundId), round);

  logger.info('Guess submitted for Family Feud', {
    roundId: round.roundId,
    userId,
    totalGuesses: Object.keys(round.guesses).length,
  });
  return round;
}

/**
 * Complete a round — score guesses and archive.
 * Uses simple case-insensitive substring matching for scoring.
 */
export async function completeRound(
  round: FamilyFeudRound,
  rotation: FamilyFeudRotation,
): Promise<FamilyFeudRound> {
  if (!round.realAnswer) {
    // Target never answered — close the round and advance rotation
    round.status = 'completed';
    round.results = { winners: [], totalGuesses: 0, revealedAt: new Date().toISOString() };
    await advanceRotation(rotation);
    await putJson(FEUD_ROUND(round.roundId), round);
    await deleteCurrentRound();
    return round;
  }

  const realLower = round.realAnswer.toLowerCase().trim();
  const winners: Array<{ userId: string; userName: string; points: number }> = [];

  for (const guess of Object.values(round.guesses)) {
    const guessLower = guess.guess.toLowerCase().trim();
    if (guessLower === realLower) {
      winners.push({ userId: guess.userId, userName: guess.userName, points: 2 });
    }
  }

  round.status = 'completed';
  round.results = {
    winners,
    totalGuesses: Object.keys(round.guesses).length,
    revealedAt: new Date().toISOString(),
  };

  // Record in rotation history
  rotation.roundHistory.push({
    userId: round.targetUserId,
    roundId: round.roundId,
    date: getEasternDateString(),
    passed: false,
  });

  // Randomly pick next person (weighted toward those who haven't gone)
  await advanceRotation(rotation);

  // Archive and clear current
  await putJson(FEUD_ROUND(round.roundId), round);
  await deleteCurrentRound();

  logger.info('Family Feud round completed', {
    roundId: round.roundId,
    winners: winners.length,
    totalGuesses: round.results.totalGuesses,
  });

  // Notify everyone about results (fire-and-forget)
  import('./notificationService').then(ns =>
    ns.writeFeudResultsNotification(
      round.question,
      round.targetUserName,
      winners.length,
      Object.keys(round.guesses).length,
    ),
  ).catch(() => { /* silent */ });

  return round;
}

/**
 * Pass turn — skip this user's round and advance.
 */
export async function passTurn(
  rotation: FamilyFeudRotation,
  userId: string,
): Promise<void> {
  rotation.passedUsers.push(userId);
  rotation.roundHistory.push({
    userId,
    roundId: '',
    date: getEasternDateString(),
    passed: true,
  });
  await putJson(FEUD_ROTATION, rotation);
  logger.info('User passed Family Feud turn', { userId });
}

/**
 * Properly clear the current round by deleting the S3 file.
 */
async function deleteCurrentRound(): Promise<void> {
  try {
    await deleteObject(FEUD_CURRENT);
  } catch {
    // File may not exist — that's fine
    await putJson(FEUD_CURRENT, null);
  }
}

/**
 * Get recent completed rounds for the timeline.
 */
export async function getRecentRounds(limit = 10): Promise<FamilyFeudRound[]> {
  const keys = await listObjects(FEUD_ROUNDS_DIR);
  // Sort by key name descending (date is in the key)
  const sortedKeys = keys.sort().reverse().slice(0, limit);

  const rounds: FamilyFeudRound[] = [];
  for (const key of sortedKeys) {
    try {
      const round = await getJson<FamilyFeudRound>(key);
      if (round) rounds.push(round);
    } catch {
      // skip
    }
  }
  return rounds;
}

// ---------------------------------------------------------------------------
// Admin Operations
// ---------------------------------------------------------------------------

/**
 * Reset the current round (admin only). Clears current round without completing it.
 */
export async function resetCurrentRound(): Promise<void> {
  await deleteCurrentRound();
  logger.info('Admin: reset current Family Feud round');
}

/**
 * Delete a specific round by ID (admin only).
 */
export async function deleteRound(roundId: string): Promise<void> {
  try {
    await deleteObject(FEUD_ROUND(roundId));
  } catch { /* may not exist */ }
  // If this is the current round, clear it
  const current = await getCurrentRound();
  if (current?.roundId === roundId) {
    await deleteCurrentRound();
  }
  logger.info('Admin: deleted Family Feud round', { roundId });
}

/**
 * Reset the entire rotation (admin only).
 */
export async function resetRotation(): Promise<void> {
  try {
    await deleteObject(FEUD_ROTATION);
  } catch { /* may not exist */ }
  await deleteCurrentRound();
  logger.info('Admin: reset Family Feud rotation');
}
