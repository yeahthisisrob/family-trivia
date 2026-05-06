/**
 * Notification types — shared between frontend and backend.
 */

// ── Notification Items ────────────────────────────────────────────

export type NotificationType =
  | 'comment'
  | 'leader_change'
  | 'high_score'
  | 'family_feud'
  | 'album_added';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
  /** Comment fields */
  contentType?: 'fact' | 'trivia' | 'album' | 'arcade';
  contentId?: string;
  commentUserId?: string;
  commentText?: string;
  threadCommentCount?: number;
  /** Album fields (for album_added notifications) */
  albumName?: string;
  albumAddedBy?: string;
  /** Leader change fields */
  newLeaderId?: string;
  previousLeaderId?: string;
  leaderType?: 'individual' | 'group';
  /** Podium position (1, 2, or 3) for individual leader changes */
  podiumPosition?: number;
  /** Family Feud fields */
  feudEventType?: 'results' | 'new_round';
  feudQuestion?: string;
  feudTargetName?: string;
  feudWinnerCount?: number;
  feudTotalGuesses?: number;
  feudPointsEarned?: number;
  /** High score fields */
  gameId?: string;
  scoreUserId?: string;
  score?: number;
  previousBest?: number;
  rank?: number;
}

// ── Summary (API response) ────────────────────────────────────────

export interface NotificationSummary {
  unreadCount: number;
  items: NotificationItem[];
}

// ── Read State (S3 per-user) ──────────────────────────────────────

export interface ReadState {
  lastViewedAt: string;
  /** Map of "contentType:contentId" → last-viewed ISO timestamp */
  viewedThreads: Record<string, string>;
}

// ── Leader State (S3 shared) ──────────────────────────────────────

export interface LeaderState {
  /** Top 3 individual players by season score */
  podium: Array<{ userId: string; score: number }>;
  individualLeaderId: string | null;
  individualLeaderScore: number;
  groupLeaderId: string | null;
  groupLeaderScore: number;
  lastChecked: string;
}
