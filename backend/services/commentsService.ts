/**
 * Comment threads: one file per commented item at comments/{type}/{id}.json.
 * Notifications read every thread, so this lives in services/ rather than in
 * the comments slice.
 */
import type {
  AddCommentRequest,
  AddCommentResponse,
  Comment,
  CommentContentType,
  CommentCounts,
  CommentThread,
} from '@family-trivia/shared';
import { getJson, listObjects, putJson } from './s3';

const threadKey = (type: CommentContentType, id: string) => `comments/${type}/${id}.json`;

function asThread(
  contentType: CommentContentType,
  contentId: string,
  raw: Partial<CommentThread> | null,
): CommentThread {
  return {
    contentType,
    contentId,
    comments: Array.isArray(raw?.comments) ? raw.comments : [],
    lastUpdated: raw?.lastUpdated || new Date().toISOString(),
  };
}

/** One item's thread; empty when nobody has commented yet. */
export async function getCommentThread(
  contentType: CommentContentType,
  contentId: string,
): Promise<CommentThread> {
  const raw = await getJson<Partial<CommentThread>>(threadKey(contentType, contentId));
  return asThread(contentType, contentId, raw);
}

export async function addComment(request: AddCommentRequest): Promise<AddCommentResponse> {
  const { contentType, contentId, userId, text, parentId } = request;
  const thread = await getCommentThread(contentType, contentId);
  const comment: Comment = {
    id: crypto.randomUUID(),
    userId,
    text,
    timestamp: new Date().toISOString(),
    ...(parentId ? { parentId } : {}),
  };
  thread.comments.push(comment);
  thread.lastUpdated = comment.timestamp;
  await putJson(threadKey(contentType, contentId), thread);
  return { comment, success: true };
}

/** How many comments each item has, and its last three commenters (newest first). */
export async function getCommentCounts(
  contentType: CommentContentType,
  contentIds: string[],
): Promise<{ counts: CommentCounts; commenters: Record<string, string[]> }> {
  const counts: CommentCounts = {};
  const commenters: Record<string, string[]> = {};
  await Promise.all(
    contentIds.map(async (id) => {
      const { comments } = await getCommentThread(contentType, id).catch(() => ({
        comments: [] as Comment[],
      }));
      counts[id] = comments.length;
      if (comments.length === 0) return;
      const seen = new Set<string>();
      for (const c of [...comments].reverse()) {
        if (seen.size === 3) break;
        seen.add(c.userId);
      }
      commenters[id] = [...seen];
    }),
  );
  return { counts, commenters };
}

/** Every thread of one type (for notifications). */
export async function getAllThreads(contentType: CommentContentType): Promise<CommentThread[]> {
  const keys = await listObjects(`comments/${contentType}/`);
  const threads = await Promise.all(
    keys.map(async (key) => {
      const id = key.slice(`comments/${contentType}/`.length, -'.json'.length);
      const raw = await getJson<Partial<CommentThread>>(key).catch(() => null);
      return raw ? asThread(contentType, id, raw) : null;
    }),
  );
  return threads.filter((t): t is CommentThread => t !== null);
}
