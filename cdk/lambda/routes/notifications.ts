// File: lambda/routes/notifications.ts
// Purpose: Notification endpoints — unread comments + leader changes.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import {
  getNotifications,
  markThreadRead,
  markAllRead,
} from '../services/notificationService';

/**
 * GET /notifications?userId=X
 * Returns unread count + notification items.
 */
export async function getNotificationsHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const userId = event.queryStringParameters?.userId;
  if (!userId) return errorResponse('Missing userId', 400);

  try {
    const summary = await getNotifications(userId);
    return successResponse(summary);
  } catch (err: any) {
    logger.error('Error fetching notifications', { userId, error: err.message });
    return errorResponse('Failed to fetch notifications', 500);
  }
}

/**
 * POST /notifications/mark-read
 * Body: { userId, contentType, contentId }
 */
export async function markReadHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId, contentType, contentId } = body;

    if (!userId || !contentType || !contentId) {
      return errorResponse('Missing userId, contentType, or contentId', 400);
    }

    await markThreadRead(userId, contentType, contentId);
    return successResponse({ success: true });
  } catch (err: any) {
    logger.error('Error marking notification read', { error: err.message });
    return errorResponse('Failed to mark read', 500);
  }
}

/**
 * POST /notifications/mark-all-read
 * Body: { userId }
 */
export async function markAllReadHandler(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { userId } = body;

    if (!userId) return errorResponse('Missing userId', 400);

    await markAllRead(userId);
    return successResponse({ success: true });
  } catch (err: any) {
    logger.error('Error marking all read', { error: err.message });
    return errorResponse('Failed to mark all read', 500);
  }
}
