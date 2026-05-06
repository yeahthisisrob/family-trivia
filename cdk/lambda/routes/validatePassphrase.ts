import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { putJson, getJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';

// Type for the user config stored in S3
interface UsersConfig {
  version: string;
  lastUpdated: string;
  users: {
    [key: string]: {
      group: string;
      color: string;
      passphrase: string;
    };
  };
}

export async function validatePassphrase(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const userId = body.userId as string;
  const passphrase = body.passphrase as string;

  if (!userId || !passphrase) {
    return errorResponse('Missing userId or passphrase', 400);
  }

  // Fetch user config from S3
  const usersConfig = await getJson<UsersConfig>('config/users.json');

  if (!usersConfig) {
    logger.error('Failed to retrieve users configuration from S3');
    return errorResponse('Internal server error', 500);
  }

  const userData = usersConfig.users[userId];
  const expected = userData?.passphrase;
  const valid = expected && expected.toLowerCase() === passphrase.toLowerCase();

  if (valid) {
    await putJson(`profile_data/${userId}.json`, {});
  }

  return successResponse({ valid });
}
