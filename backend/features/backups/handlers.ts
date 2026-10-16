/** Admin › Settings › Backups: what's been copied, and a button to copy now. */
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { errorResponse, successResponse } from '../../config';
import { requireAdmin } from '../../services/adminAuth';
import { getSetting } from '../../services/settings';
import { BACKUP_BUCKET, listSnapshots, readStatus, snapshot } from './snapshot';

export async function getBackups(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  const [status, snapshots, automatic] = await Promise.all([
    readStatus(),
    listSnapshots(),
    getSetting('backups.automatic'),
  ]);
  return successResponse({
    ...status,
    snapshots,
    automatic: automatic === true,
    configured: !!BACKUP_BUCKET,
  });
}

export async function makeBackup(
  _e: APIGatewayProxyEvent,
  userId: string,
): Promise<APIGatewayProxyResult> {
  const denied = await requireAdmin(userId);
  if (denied) return errorResponse(denied, 403);
  const run = await snapshot('manual', userId);
  return run.ok
    ? successResponse(run)
    : errorResponse(run.error ?? 'The backup did not finish', 503);
}
