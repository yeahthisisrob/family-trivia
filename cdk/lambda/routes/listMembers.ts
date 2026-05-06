import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { getUsersInGroup } from '../services/users';
import { logger } from '../services/logger';

export async function listMembers(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const groupId = event.queryStringParameters?.groupId;

  if (!groupId) {
    logger.warn('Missing groupId parameter in listMembers request');
    return errorResponse('Missing groupId', 400);
  }

  logger.info('Processing listMembers request', { groupId });

  try {
    // Get members from S3 config
    const members = await getUsersInGroup(groupId);
    
    // Check if the group exists or has no members
    if (!members || members.length === 0) {
      logger.info('No members found for group', { groupId });
      return successResponse([]);
    }

    const result = await Promise.all(
      members.map(async (userId) => {
        try {
          // Check for answer history instead, which is a stronger indicator of actual usage
          const historyPath = `answers/history/${userId}.json`;
          const history = await getJson<any[]>(historyPath);
          
          // A user is considered activated if they have answer history with at least one entry
          const hasHistory = Array.isArray(history) && history.length > 0;
          
          logger.debug('Checked user activation status', { 
            userId, 
            hasHistory, 
            historyCount: Array.isArray(history) ? history.length : 0
          });
          
          return { userId, activated: hasHistory };
        } catch (err) {
          // If history doesn't exist, user is not activated
          logger.debug('User history not found', { userId });
          return { userId, activated: false };
        }
      })
    );

    logger.info('Successfully retrieved member list', { 
      groupId, 
      memberCount: result.length,
      activatedCount: result.filter(m => m.activated).length
    });
    return successResponse(result);
  } catch (error) {
    logger.error('Error fetching members', {
      groupId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return errorResponse('Failed to fetch members', 500, error instanceof Error ? error.message : 'Unknown error');
  }
}
