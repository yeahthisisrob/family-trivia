// Module: social — Unified comments API

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

import type {
  Comment,
  CommentThread,
  CommentContentType,
  AddCommentResponse,
  CommentCounts,
} from '@family-trivia/shared';

export type {
  Comment,
  CommentThread,
  CommentContentType,
  AddCommentResponse,
  CommentCounts,
} from '@family-trivia/shared';

const logger = createLogger('CommentsAPI');

/**
 * Fetch a single comment thread.
 */
export async function getCommentThread(
  contentType: CommentContentType,
  contentId: string,
): Promise<CommentThread> {
  try {
    const response = await apiService.request<{ thread: CommentThread }>(
      `/comments?contentType=${contentType}&contentId=${encodeURIComponent(contentId)}`,
      { method: 'GET' },
    );
    if (response?.thread && Array.isArray(response.thread.comments)) {
      return response.thread;
    }
    return { contentType, contentId, comments: [], lastUpdated: new Date().toISOString() };
  } catch {
    return { contentType, contentId, comments: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Fetch comment counts for a batch of IDs. Lightweight — for timeline badges.
 */
export async function getCommentCounts(
  contentType: CommentContentType,
  ids: string[],
): Promise<{ counts: CommentCounts; commenters: Record<string, string[]> }> {
  if (ids.length === 0) return { counts: {}, commenters: {} };
  try {
    const response = await apiService.request<{ counts: CommentCounts; commenters?: Record<string, string[]> }>(
      `/comments/counts?contentType=${contentType}&ids=${ids.map(encodeURIComponent).join(',')}`,
      { method: 'GET' },
    );
    return { counts: response?.counts || {}, commenters: response?.commenters || {} };
  } catch {
    return { counts: {}, commenters: {} };
  }
}

/**
 * Fetch all comment threads for a content type. Used by the "Comments" tab.
 */
export async function getAllCommentThreads(
  contentType: CommentContentType,
): Promise<CommentThread[]> {
  try {
    const response = await apiService.request<{ threads: CommentThread[] }>(
      `/comments?contentType=${contentType}&getAll=true`,
      { method: 'GET' },
      `all_${contentType}_comments`,
      true, // forceFresh
    );
    if (response?.threads && Array.isArray(response.threads)) {
      logger.info(`Retrieved ${response.threads.length} ${contentType} comment threads`);
      return response.threads;
    }
    return [];
  } catch (error) {
    logger.error(`Error getting all ${contentType} comment threads:`, error);
    return [];
  }
}

/**
 * Add a comment to a content item. Returns the created comment.
 */
export async function addComment(
  contentType: CommentContentType,
  contentId: string,
  userId: string,
  text: string,
  parentId?: string,
): Promise<Comment> {
  try {
    logger.debug(`Adding comment to ${contentType}/${contentId} by ${userId}`);
    const response = await apiService.request<AddCommentResponse>('/comments', {
      method: 'POST',
      body: JSON.stringify({ contentType, contentId, userId, text, parentId }),
    });
    return response.comment;
  } catch (error) {
    logger.error(`Error adding comment to ${contentType}/${contentId}:`, error);
    throw new Error(`Failed to add comment: ${(error as Error).message}`);
  }
}

