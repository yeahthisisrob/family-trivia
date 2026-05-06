// Module: notifications
// Fetch unread notifications, mark read, mark all read.

import { apiService } from '../../services/ApiService';
import { createLogger } from '../../utils/logger';

import type { CommentContentType, NotificationSummary } from '@family-trivia/shared';

export type { NotificationSummary, NotificationItem } from '@family-trivia/shared';

const logger = createLogger('NotificationsAPI');

/**
 * Get all notifications for a user (unread comments + leader changes).
 */
export async function getNotifications(userId: string): Promise<NotificationSummary> {
  try {
    return await apiService.request<NotificationSummary>(
      `/notifications?userId=${encodeURIComponent(userId)}`,
      { method: 'GET' },
    );
  } catch (error) {
    logger.error('Failed to fetch notifications', error);
    return { unreadCount: 0, items: [] };
  }
}

/**
 * Mark a specific thread as read.
 */
export async function markThreadRead(
  userId: string,
  contentType: CommentContentType,
  contentId: string,
): Promise<void> {
  try {
    await apiService.request('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ userId, contentType, contentId }),
    });
  } catch (error) {
    logger.error('Failed to mark thread read', error);
  }
}

/**
 * Mark all notifications as read.
 */
export async function markAllRead(userId: string): Promise<void> {
  try {
    await apiService.request('/notifications/mark-all-read', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  } catch (error) {
    logger.error('Failed to mark all read', error);
  }
}
