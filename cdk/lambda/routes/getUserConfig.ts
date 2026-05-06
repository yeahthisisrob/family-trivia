// File: lambda/routes/getUserConfig.ts
// Purpose: Get user configuration including groups and colors from S3

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';

interface UserConfigData {
  version: string;
  lastUpdated: string;
  users: Record<string, {
    group: string;
    color: string;
  }>;
}

export async function getUserConfig(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Get user config from S3
    const userConfig = await getJson<UserConfigData>(S3_PATHS.USERS_CONFIG);
    
    if (!userConfig) {
      return errorResponse('User configuration not found', 404);
    }
    
    return successResponse(userConfig);
  } catch (err: any) {
    logger.error('Error fetching user configuration:', err);
    
    return errorResponse('Failed to fetch user configuration', 500, err.message);
  }
}