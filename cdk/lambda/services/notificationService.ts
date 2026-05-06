// File: lambda/services/notificationService.ts
// Purpose: S3-backed notification system for unread comments and leader changes.

import { getJson, putJson } from './s3';
import { getAllThreads } from './commentsService';
import { getAllPlayerState, getSeasonSummary } from './playerStateService';
import { computePoints } from './scoring';
import { getAllUsers } from './users';
import { logger } from './logger';
import { HistoryEntry } from '@family-trivia/shared';
import type {
  NotificationItem,
  NotificationSummary,
  ReadState,
  LeaderState,
} from '@family-trivia/shared';

// ── S3 Paths ──────────────────────────────────────────────────────

const READ_STATE_KEY = (userId: string) => `notifications/read-state/${userId}.json`;
const LEADER_STATE_KEY = 'notifications/leader-state.json';

// ── Read State ────────────────────────────────────────────────────

async function getReadState(userId: string): Promise<ReadState> {
  const state = await getJson<ReadState>(READ_STATE_KEY(userId));
  return state ?? { lastViewedAt: '1970-01-01T00:00:00Z', viewedThreads: {} };
}

async function saveReadState(userId: string, state: ReadState): Promise<void> {
  await putJson(READ_STATE_KEY(userId), state);
}

// ── Unread Comments ───────────────────────────────────────────────

/**
 * Get unread comment notifications for a user.
 * A thread is "relevant" if the user posted a comment in it.
 * A thread is "unread" if its lastUpdated > the user's last-viewed timestamp.
 */
export async function getUnreadComments(userId: string): Promise<NotificationItem[]> {
  const readState = await getReadState(userId);
  const items: NotificationItem[] = [];

  // Quick bail: if user viewed within last 30 seconds, skip expensive thread loading.
  // Comments don't arrive that fast — wait for next poll cycle.
  const timeSinceView = Date.now() - new Date(readState.lastViewedAt).getTime();
  if (timeSinceView < 30_000) return [];

  // Load all threads for every content type
  const [factThreads, triviaThreads, albumThreads, arcadeThreads] = await Promise.all([
    getAllThreads('fact'),
    getAllThreads('trivia'),
    getAllThreads('album'),
    getAllThreads('arcade'),
  ]);

  // For albums, load the albums list once so we can check "am I the album owner?"
  // For arcade there is no owner — only participation matters.
  let albumOwners: Record<string, string> = {};
  try {
    const albumsData = await getJson<{ albums: Array<{ id: string; createdBy: string }> }>(
      'photos/albums.json',
    );
    if (albumsData?.albums) {
      albumOwners = Object.fromEntries(albumsData.albums.map(a => [a.id, a.createdBy]));
    }
  } catch { /* ok */ }

  const allThreads = [
    ...factThreads.map(t => ({ ...t, contentType: 'fact' as const })),
    ...triviaThreads.map(t => ({ ...t, contentType: 'trivia' as const })),
    ...albumThreads.map(t => ({ ...t, contentType: 'album' as const })),
    ...arcadeThreads.map(t => ({ ...t, contentType: 'arcade' as const })),
  ];

  for (const thread of allThreads) {
    // Is this thread relevant to the user?
    const userParticipated = thread.comments.some(c => c.userId === userId);
    const userOwnsContent =
      (thread.contentType === 'fact' || thread.contentType === 'trivia')
        ? thread.contentId.startsWith(`${userId}_`)
        : thread.contentType === 'album'
          ? albumOwners[thread.contentId] === userId
          : false; // arcade: no owner, participation only
    if (!userParticipated && !userOwnsContent) continue;

    // Is it unread?
    const threadKey = `${thread.contentType}:${thread.contentId}`;
    const lastViewed = readState.viewedThreads[threadKey] || readState.lastViewedAt;
    if (thread.lastUpdated <= lastViewed) continue;

    // Find the newest comment by someone other than the current user
    const newComments = thread.comments
      .filter(c => c.userId !== userId && c.timestamp > lastViewed)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    if (newComments.length === 0) continue;

    const latest = newComments[0];
    items.push({
      id: `comment-${thread.contentType}-${thread.contentId}`,
      type: 'comment',
      timestamp: latest.timestamp,
      read: false,
      contentType: thread.contentType,
      contentId: thread.contentId,
      commentUserId: latest.userId,
      commentText: latest.text.length > 80 ? latest.text.substring(0, 77) + '...' : latest.text,
      threadCommentCount: newComments.length,
    });
  }

  // Sort newest first
  items.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  return items;
}

// ── Leader Change ─────────────────────────────────────────────────

/**
 * Check if the season leader (individual or group) has changed.
 * Compares current state with the stored leader-state.json.
 * Returns notification items if changed, and updates stored state.
 */
export async function checkLeaderChange(): Promise<NotificationItem[]> {
  const items: NotificationItem[] = [];

  try {
    const [summary, storedState, playerStates] = await Promise.all([
      getSeasonSummary(),
      getJson<LeaderState>(LEADER_STATE_KEY),
      getAllPlayerState(),
    ]);

    // Compute season-filtered scores (matches leaderboard display)
    const seasonStart = summary.activeSeason?.startDate;
    const seasonEnd = summary.activeSeason?.endDate;

    const getSeasonScore = (history: HistoryEntry[]): number => {
      let s = 0;
      for (const h of history) {
        const d = h.timestamp?.split('T')[0];
        if (!d) continue;
        if (seasonStart && d < seasonStart) continue;
        if (seasonEnd && d > seasonEnd) continue;
        if (h.correct) s += computePoints(h);
      }
      return s;
    };

    // Current top 3 individuals by season score
    const seasonScores = new Map<string, number>();
    for (const [uid, state] of playerStates) {
      seasonScores.set(uid, getSeasonScore(state.history));
    }

    const sortedPlayers = [...seasonScores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) // stable tie-break by userId
      .slice(0, 3)
      .map(([userId, score]) => ({ userId, score }));

    const topScorer = sortedPlayers[0]?.userId ?? null;
    const topScore = sortedPlayers[0]?.score ?? 0;

    // Current group leader by total season score
    const users = await getAllUsers();
    const userConfig = await getJson<any>(`config/users.json`);
    const groupScores = new Map<string, number>();
    for (const uid of users) {
      const score = seasonScores.get(uid) ?? 0;
      const userEntry = userConfig?.find?.((u: any) => u.userId === uid);
      if (userEntry?.group) {
        groupScores.set(userEntry.group, (groupScores.get(userEntry.group) ?? 0) + score);
      }
    }

    let topGroup: string | null = null;
    let topGroupScore = 0;
    for (const [gid, score] of groupScores) {
      if (score > topGroupScore) {
        topGroupScore = score;
        topGroup = gid;
      }
    }

    const prev = storedState ?? {
      podium: [],
      individualLeaderId: null,
      individualLeaderScore: 0,
      groupLeaderId: null,
      groupLeaderScore: 0,
      lastChecked: new Date().toISOString(),
    };
    const prevPodium = prev.podium ?? [];

    // Check for podium changes (top 3 individuals)
    // Only fire when the PERSON at a position changes — not score changes.
    if (prevPodium.length > 0) {
      for (let pos = 0; pos < sortedPlayers.length; pos++) {
        const current = sortedPlayers[pos];
        const prevAtPos = prevPodium[pos];

        // Same person at same position — no change, skip
        if (prevAtPos && prevAtPos.userId === current.userId) continue;

        // This person was already at this position or higher — they didn't move up
        const prevPos = prevPodium.findIndex(p => p.userId === current.userId);
        if (prevPos >= 0 && prevPos <= pos) continue;

        // Same score as previous holder — tie reordering, not a real move
        if (prevAtPos && current.score === prevAtPos.score) continue;

        const posLabels = ['1st', '2nd', '3rd'];
        items.push({
          id: `leader-individual-${pos}-${Date.now()}`,
          type: 'leader_change',
          timestamp: new Date().toISOString(),
          read: false,
          leaderType: 'individual',
          newLeaderId: current.userId,
          previousLeaderId: prevAtPos?.userId,
          podiumPosition: pos + 1,
        });
        logger.info(`Podium change: ${current.userId} moved to ${posLabels[pos]}`, {
          position: pos + 1,
          userId: current.userId,
          score: current.score,
          previousAtPosition: prevAtPos?.userId,
        });
      }
    }

    // Check for group leader change — same score guard
    if (topGroup && topGroup !== prev.groupLeaderId && prev.groupLeaderId !== null
        && topGroupScore > prev.groupLeaderScore) {
      items.push({
        id: `leader-group-${Date.now()}`,
        type: 'leader_change',
        timestamp: new Date().toISOString(),
        read: false,
        leaderType: 'group',
        newLeaderId: topGroup,
        previousLeaderId: prev.groupLeaderId,
      });
      logger.info('Group leader changed', {
        from: prev.groupLeaderId,
        to: topGroup,
      });
    }

    // Write leader change events to S3 (if any changes detected)
    if (items.length > 0) {
      try {
        const existing = (await getJson<NotificationItem[]>(LEADER_EVENTS_KEY)) ?? [];
        const updated = [...items, ...existing].slice(0, 20);
        await putJson(LEADER_EVENTS_KEY, updated);
      } catch (err) {
        logger.warn('Failed to write leader change events', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    // Update stored state
    const newState: LeaderState = {
      podium: sortedPlayers,
      individualLeaderId: topScorer,
      individualLeaderScore: topScore,
      groupLeaderId: topGroup,
      groupLeaderScore: topGroupScore,
      lastChecked: new Date().toISOString(),
    };
    await putJson(LEADER_STATE_KEY, newState);

    return items;
  } catch (err) {
    logger.error('Error checking leader change', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Combined Notifications ────────────────────────────────────────

/**
 * Get all notifications for a user: unread comments + leader changes + high scores.
 */
export async function getNotifications(userId: string): Promise<NotificationSummary> {
  const [commentItems, leaderItems, highScoreItems, feudItems, albumItems] = await Promise.all([
    getUnreadComments(userId),
    getLeaderChangeNotifications(userId),
    getHighScoreNotifications(userId),
    getFeudNotifications(userId),
    getAlbumAddedNotifications(userId),
  ]);

  const items = [...feudItems, ...highScoreItems, ...leaderItems, ...albumItems, ...commentItems];
  return {
    unreadCount: items.filter(i => !i.read).length,
    items,
  };
}

// ── High Score Notifications ──────────────────────────────────────

const HIGH_SCORE_EVENTS_KEY = 'notifications/events/high-scores.json';

/**
 * Get high score notifications the user hasn't seen yet.
 * Shows events from ALL users (so everyone sees when someone sets a record).
 */
async function getHighScoreNotifications(userId: string): Promise<NotificationItem[]> {
  const [readState, events] = await Promise.all([
    getReadState(userId),
    getJson<NotificationItem[]>(HIGH_SCORE_EVENTS_KEY),
  ]);

  if (!events?.length) return [];

  // Filter to events after the user's last viewed time
  return events
    .filter(e => e.timestamp > readState.lastViewedAt)
    .map(e => ({ ...e, read: false }));
}

const LEADER_EVENTS_KEY = 'notifications/events/leader-changes.json';

/**
 * Get leader change notifications the user hasn't seen.
 * Reads from events file written by checkLeaderChange() — NOT re-derived
 * from leader state (which would fire on every state update).
 */
async function getLeaderChangeNotifications(userId: string): Promise<NotificationItem[]> {
  const [readState, events] = await Promise.all([
    getReadState(userId),
    getJson<NotificationItem[]>(LEADER_EVENTS_KEY),
  ]);
  if (!events?.length) return [];
  return events
    .filter(e => e.timestamp > readState.lastViewedAt)
    .map(e => ({ ...e, read: false }));
}

// ── Mark Read ─────────────────────────────────────────────────────

/**
 * Mark a specific thread as read for a user.
 */
export async function markThreadRead(
  userId: string,
  contentType: 'fact' | 'trivia',
  contentId: string,
): Promise<void> {
  const state = await getReadState(userId);
  state.viewedThreads[`${contentType}:${contentId}`] = new Date().toISOString();
  await saveReadState(userId, state);
}

// ── Family Feud Notifications ─────────────────────────────────────

const FEUD_EVENTS_KEY = 'notifications/events/family-feud.json';

/**
 * Write a Family Feud results notification (round completed).
 * Called from familyFeudService.completeRound().
 */
export async function writeFeudResultsNotification(
  question: string,
  targetName: string,
  winnerCount: number,
  totalGuesses: number,
): Promise<void> {
  try {
    const events = (await getJson<NotificationItem[]>(FEUD_EVENTS_KEY)) ?? [];
    events.unshift({
      id: `feud-results-${Date.now()}`,
      type: 'family_feud',
      timestamp: new Date().toISOString(),
      read: false,
      feudEventType: 'results',
      feudQuestion: question,
      feudTargetName: targetName,
      feudWinnerCount: winnerCount,
      feudTotalGuesses: totalGuesses,
    });
    await putJson(FEUD_EVENTS_KEY, events.slice(0, 20));
  } catch (err) {
    logger.warn('Failed to write feud results notification', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Write a "new Family Feud round available" notification.
 * Called when a new round starts.
 */
export async function writeFeudNewRoundNotification(
  question: string,
  targetName: string,
): Promise<void> {
  try {
    const events = (await getJson<NotificationItem[]>(FEUD_EVENTS_KEY)) ?? [];
    events.unshift({
      id: `feud-new-${Date.now()}`,
      type: 'family_feud',
      timestamp: new Date().toISOString(),
      read: false,
      feudEventType: 'new_round',
      feudQuestion: question,
      feudTargetName: targetName,
    });
    await putJson(FEUD_EVENTS_KEY, events.slice(0, 20));
  } catch (err) {
    logger.warn('Failed to write feud new round notification', { error: err instanceof Error ? err.message : String(err) });
  }
}

/**
 * Get Family Feud notifications the user hasn't seen.
 */
async function getFeudNotifications(userId: string): Promise<NotificationItem[]> {
  const [readState, events] = await Promise.all([
    getReadState(userId),
    getJson<NotificationItem[]>(FEUD_EVENTS_KEY),
  ]);
  if (!events?.length) return [];
  return events
    .filter(e => e.timestamp > readState.lastViewedAt)
    .map(e => ({ ...e, read: false }));
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllRead(userId: string): Promise<void> {
  const state = await getReadState(userId);
  state.lastViewedAt = new Date().toISOString();
  // Clear individual thread timestamps — lastViewedAt covers everything
  state.viewedThreads = {};
  await saveReadState(userId, state);
}

// ── Album Added Notifications ─────────────────────────────────────

const ALBUM_EVENTS_KEY = 'notifications/events/albums.json';

/**
 * Write a "new album added" notification when someone shares a new
 * photo album. Called from addPhotoAlbum.
 */
export async function writeAlbumAddedNotification(
  albumId: string,
  albumName: string,
  addedBy: string,
): Promise<void> {
  try {
    const events = (await getJson<NotificationItem[]>(ALBUM_EVENTS_KEY)) ?? [];
    events.unshift({
      id: `album-added-${albumId}`,
      type: 'album_added',
      timestamp: new Date().toISOString(),
      read: false,
      contentType: 'album',
      contentId: albumId,
      albumName,
      albumAddedBy: addedBy,
    });
    // Keep the last 20
    await putJson(ALBUM_EVENTS_KEY, events.slice(0, 20));
  } catch (err) {
    logger.warn('Failed to write album added notification', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Return album-added events the user hasn't seen, excluding events
 * they caused themselves.
 */
async function getAlbumAddedNotifications(userId: string): Promise<NotificationItem[]> {
  const [readState, events] = await Promise.all([
    getReadState(userId),
    getJson<NotificationItem[]>(ALBUM_EVENTS_KEY),
  ]);
  if (!events?.length) return [];
  return events
    .filter(e => e.timestamp > readState.lastViewedAt)
    .filter(e => e.albumAddedBy !== userId)
    .map(e => ({ ...e, read: false }));
}
