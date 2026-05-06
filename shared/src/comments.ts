// ── Unified Comments ──

/**
 * Content types that support comments.
 *   - fact/trivia: existing timeline items keyed by `${userId}_${timestamp}`
 *   - album: photo album entries keyed by album id (`alb_...`)
 *   - arcade: arcade games keyed by game id (`snake`, `tetris`, `slot-machine`,
 *     `curling`, `crossword`)
 */
export type CommentContentType = 'fact' | 'trivia' | 'album' | 'arcade';

/** A single comment on any content item */
export interface Comment {
  id: string;
  userId: string;
  text: string;
  timestamp: string;
  parentId?: string;
}

/** A thread of comments on a specific content item */
export interface CommentThread {
  contentType: CommentContentType;
  contentId: string;
  comments: Comment[];
  lastUpdated: string;
  /** Client-side only: when this thread was last fetched (for TTL dedup) */
  _fetchedAt?: number;
}

/** Request to add a comment */
export interface AddCommentRequest {
  contentType: CommentContentType;
  contentId: string;
  userId: string;
  text: string;
  parentId?: string;
}

/** Response after adding a comment */
export interface AddCommentResponse {
  comment: Comment;
  success: boolean;
}

/** Batch comment counts keyed by contentId */
export interface CommentCounts {
  [contentId: string]: number;
}

