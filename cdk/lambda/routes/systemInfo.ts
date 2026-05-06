// File: lambda/routes/systemInfo.ts
// Purpose: Admin-only system info — deployment config, health check, stats.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse, BUCKET } from '../config';
import { getJson, listObjects, fileExists } from '../services/s3';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';

export async function getSystemInfo(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  try {
    // Deployment info from environment
    const deployment = {
      region: process.env.AWS_REGION || 'unknown',
      bucket: BUCKET,
      bedrockModel: process.env.BEDROCK_MODEL_ID || 'unknown',
      nodeEnv: process.env.NODE_ENV || 'unknown',
    };

    // Health check — verify required S3 files exist
    const [hasUsers, hasHierarchy, hasSeasons, hasCategories] = await Promise.all([
      fileExists(S3_PATHS.USERS_CONFIG),
      fileExists(S3_PATHS.FAMILY_HIERARCHY),
      fileExists(S3_PATHS.SEASONS_CONFIG),
      fileExists('categories/categories.json'),
    ]);

    const health = {
      usersConfig: hasUsers,
      familyHierarchy: hasHierarchy,
      seasonsConfig: hasSeasons,
      categories: hasCategories,
      allHealthy: hasUsers && hasHierarchy && hasSeasons,
    };

    // Stats
    const [usersConfig, seasonsConfig] = await Promise.all([
      getJson<any>(S3_PATHS.USERS_CONFIG),
      getJson<any>(S3_PATHS.SEASONS_CONFIG),
    ]);

    const userCount = usersConfig?.users ? Object.keys(usersConfig.users).length : 0;
    const activeSeason = (seasonsConfig?.seasons || []).find((s: any) => s.status === 'active');
    const totalSeasons = seasonsConfig?.seasons?.length || 0;

    // Count trivia questions in bank
    let triviaQuestionCount = 0;
    try {
      const bankFiles = await listObjects('trivia-bank/');
      triviaQuestionCount = bankFiles.length;
    } catch { /* no bank */ }

    const stats = {
      userCount,
      activeSeason: activeSeason ? { name: activeSeason.name, startDate: activeSeason.startDate } : null,
      totalSeasons,
      triviaQuestionCount,
    };

    return successResponse({ deployment, health, stats });
  } catch (err: any) {
    logger.error('Error getting system info', { error: err.message });
    return errorResponse('Failed to get system info', 500);
  }
}
