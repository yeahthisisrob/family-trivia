import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';
import { getJson, putJson, listObjects } from './s3';
import { getFactHistory } from './factHistoryService';
import {
  Comment,
  CommentThread,
  CommentContentType,
  AddCommentRequest,
  AddCommentResponse,
  CommentCounts,
} from '../types/comments';

/** S3 key for a comment thread. Tries new path first, falls back to legacy. */
function threadKey(contentType: CommentContentType, contentId: string): string {
  return `comments/${contentType}/${contentId}.json`;
}

function legacyKey(contentType: CommentContentType, contentId: string): string {
  return contentType === 'fact'
    ? `facts/comments/${contentId}.json`
    : `trivia/comments/${contentId}.json`;
}

/** Normalize a legacy thread object into the unified shape. */
function normalize(contentType: CommentContentType, contentId: string, raw: any): CommentThread {
  return {
    contentType,
    contentId,
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    lastUpdated: raw.lastUpdated || new Date().toISOString(),
  };
}

/**
 * Get a single comment thread. Reads new path, falls back to legacy.
 */
export async function getCommentThread(
  contentType: CommentContentType,
  contentId: string,
): Promise<CommentThread> {
  try {
    // Try new path first
    let raw = await getJson<any>(threadKey(contentType, contentId));
    if (!raw) {
      // Fallback to legacy path
      raw = await getJson<any>(legacyKey(contentType, contentId));
    }
    if (raw) {
      return normalize(contentType, contentId, raw);
    }
    return { contentType, contentId, comments: [], lastUpdated: new Date().toISOString() };
  } catch (error) {
    logger.error(`Error getting comment thread ${contentType}/${contentId}:`, { error });
    throw error;
  }
}

/**
 * Add a comment to a thread.
 */
export async function addComment(request: AddCommentRequest): Promise<AddCommentResponse> {
  const { contentType, contentId, userId, text, parentId } = request;
  logger.debug(`Adding comment to ${contentType}/${contentId} by ${userId}`);

  const thread = await getCommentThread(contentType, contentId);

  const newComment: Comment = {
    id: uuidv4(),
    userId,
    text,
    timestamp: new Date().toISOString(),
    parentId,
  };

  thread.comments.push(newComment);
  thread.lastUpdated = new Date().toISOString();

  await putJson(threadKey(contentType, contentId), thread);
  logger.debug(`Saved comment ${newComment.id} to ${contentType}/${contentId}`);

  return { comment: newComment, success: true };
}

/**
 * Get comment counts for a batch of content IDs. Lightweight — only reads
 * thread files and extracts `.comments.length`.
 */
export async function getCommentCounts(
  contentType: CommentContentType,
  contentIds: string[],
): Promise<{ counts: CommentCounts; commenters: Record<string, string[]> }> {
  const counts: CommentCounts = {};
  const commenters: Record<string, string[]> = {};

  await Promise.all(
    contentIds.map(async (id) => {
      try {
        const thread = await getCommentThread(contentType, id);
        counts[id] = thread.comments.length;
        if (thread.comments.length > 0) {
          // Unique commenter userIds (most recent first, max 3)
          const seen = new Set<string>();
          for (let i = thread.comments.length - 1; i >= 0 && seen.size < 3; i--) {
            seen.add(thread.comments[i].userId);
          }
          commenters[id] = [...seen];
        }
      } catch {
        counts[id] = 0;
      }
    }),
  );

  return { counts, commenters };
}

/**
 * Get all comment threads for a content type.
 * Used by the "Comments" tab on the timeline and legacy getAll endpoints.
 */
export async function getAllThreads(contentType: CommentContentType): Promise<CommentThread[]> {
  logger.debug(`Getting all ${contentType} comment threads`);

  // Check new path first, fall back to legacy
  let objectKeys = await listObjects(`comments/${contentType}/`);
  const legacyPrefix = contentType === 'fact' ? 'facts/comments/' : 'trivia/comments/';

  if (objectKeys.length === 0) {
    objectKeys = await listObjects(legacyPrefix);
  }

  const threads: CommentThread[] = [];

  for (const key of objectKeys) {
    try {
      const raw = await getJson<any>(key);
      if (raw) {
        // Extract contentId from key (last segment without .json)
        const filename = key.split('/').pop()?.replace('.json', '') || '';
        threads.push(normalize(contentType, filename, raw));
      }
    } catch (err) {
      logger.error(`Error fetching thread ${key}:`, { error: err });
    }
  }

  // Enrich fact threads with original question/answer data
  if (contentType === 'fact') {
    await enrichThreadsWithFactData(threads);
  }

  logger.debug(`Retrieved ${threads.length} ${contentType} comment threads`);
  return threads;
}

/**
 * Enrich fact comment threads with the original question/answer from fact history.
 * The contentId format is `{userId}_{timestamp}`.
 */
async function enrichThreadsWithFactData(threads: CommentThread[]): Promise<void> {
  const threadsByUser = new Map<string, CommentThread[]>();
  for (const thread of threads) {
    const idx = thread.contentId.indexOf('_');
    if (idx <= 0) continue;
    const userId = thread.contentId.substring(0, idx);
    if (!threadsByUser.has(userId)) threadsByUser.set(userId, []);
    threadsByUser.get(userId)!.push(thread);
  }

  await Promise.all(
    Array.from(threadsByUser.entries()).map(async ([userId, userThreads]) => {
      try {
        const entries = await getFactHistory(userId);
        const byDate = new Map<string, { question: string; answer: string; fact: string }>();
        for (const e of entries) {
          byDate.set(e.date, { question: e.question, answer: e.answer, fact: e.fact });
        }

        for (const thread of userThreads) {
          const timestamp = thread.contentId.substring(thread.contentId.indexOf('_') + 1);
          const threadDate = timestamp.split('T')[0];
          const match = byDate.get(threadDate);
          if (match?.question) {
            (thread as any).question = match.question;
            (thread as any).answer = match.answer;
            (thread as any).fact = match.fact;
          }
        }
      } catch (err) {
        logger.debug(`Could not enrich facts for user ${userId}`, {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
}
