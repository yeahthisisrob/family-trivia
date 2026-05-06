// File: lambda/routes/groupDescription.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson, putJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { getUserGroup } from '../services/users';
import { logger } from '../services/logger';

const GROUP_DESCRIPTIONS_KEY = 'groups/descriptions.json';

interface GroupDescription {
  description: string;
  lastUpdated: string;
  updatedBy?: string;
}

// Get all group descriptions, or if a specific group is provided, just that one
export async function getGroupDescriptions(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const groupId = event.queryStringParameters?.groupId;
    
    // Load all descriptions from S3
    const allDescriptions = await getJson<Record<string, GroupDescription>>(GROUP_DESCRIPTIONS_KEY) || {};

    // If a specific group is requested, return just that one
    if (groupId) {
      const description = allDescriptions[groupId] || {
        description: "No description provided yet",
        lastUpdated: new Date().toISOString()
      };
      return successResponse({ groupId, description });
    }
    
    // Otherwise return all descriptions
    return successResponse({ descriptions: allDescriptions });
  } catch (err) {
    logger.error('Error fetching group descriptions:', err as Error);
    return errorResponse('Failed to retrieve group descriptions', 500);
  }
}

// Update a specific group's description
export async function updateGroupDescription(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Check that we have a body
    if (!event.body) {
      return errorResponse('Missing request body', 400);
    }
    
    // Parse the update request
    const { userId, groupId, description } = JSON.parse(event.body);
    
    // Validate inputs
    if (!userId || !groupId || !description) {
      return errorResponse('Missing required fields: userId, groupId, and description', 400);
    }
    
    // Check if user is part of the group they're trying to update
    const userGroup = await getUserGroup(userId);
    if (userGroup !== groupId) {
      return errorResponse('Unauthorized: You can only update your own group description', 403);
    }
    
    // Get existing descriptions
    const allDescriptions = await getJson<Record<string, GroupDescription>>(GROUP_DESCRIPTIONS_KEY) || {};
    
    // Update the specific group description
    allDescriptions[groupId] = {
      description,
      lastUpdated: new Date().toISOString(),
      updatedBy: userId,
    };
    
    // Save back to S3
    await putJson(GROUP_DESCRIPTIONS_KEY, allDescriptions);
    
    return successResponse({
      success: true,
      groupId,
      description: allDescriptions[groupId]
    });
  } catch (err) {
    logger.error('Error updating group description:', err as Error);
    return errorResponse('Failed to update group description', 500);
  }
}