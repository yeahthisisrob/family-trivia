// File: lambda/routes/suggestGroupDescription.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { getUserGroup, getUsersInGroup } from '../services/users';
import { generateGroupDescription } from '../services/bedrock/groups/suggestDescription';
import { logger } from '../services/logger';

// S3 keys for various data
const GROUP_DESCRIPTIONS_KEY = 'groups/descriptions.json';
const CUSTOM_CATEGORIES_KEY_PREFIX = 'users/';
const FACTS_KEY_PREFIX = 'profiles/';

/**
 * Suggests a new group description using Bedrock AI based on group activity
 */
export async function suggestGroupDescription(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Check that we have a body
    if (!event.body) {
      return errorResponse('Missing request body', 400);
    }
    
    // Parse the request
    const { userId } = JSON.parse(event.body);
    
    // Validate inputs
    if (!userId) {
      return errorResponse('Missing required field: userId', 400);
    }
    
    // Get the user's group
    const groupId = await getUserGroup(userId);
    if (!groupId) {
      return errorResponse('User does not belong to a group', 400);
    }

    // 1. Get the current group description
    const allDescriptions = await getJson<Record<string, { description: string, lastUpdated: string }>>(GROUP_DESCRIPTIONS_KEY) || {};
    const currentDescription = allDescriptions[groupId]?.description || '';

    // 2. Get all members in this group
    const groupMembers = await getUsersInGroup(groupId);
    
    // 3. Collect custom categories from all group members
    const customCategories: string[] = [];
    for (const member of groupMembers) {
      try {
        const catData = await getJson<{ lastCustomCategory?: { title: string, description: string } }>(
          `${CUSTOM_CATEGORIES_KEY_PREFIX}${member}/categories.json`
        );
        if (catData?.lastCustomCategory) {
          customCategories.push(`${member}'s category: ${catData.lastCustomCategory.title}`);
        }
      } catch (error) {
        logger.warn(`Error fetching custom categories for ${member}:`, error as Error);
        // Continue with other members even if this one fails
      }
    }
    
    // 4. Collect some personal facts from all group members
    const facts: string[] = [];
    for (const member of groupMembers) {
      try {
        const profileData = await getJson<{ facts?: { question: string, answer: string }[] }>(
          `${FACTS_KEY_PREFIX}${member}.json`
        );
        if (profileData?.facts && profileData.facts.length > 0) {
          // Add the most recent fact
          const recentFact = profileData.facts[profileData.facts.length - 1];
          facts.push(`${member} - Q: ${recentFact.question} A: ${recentFact.answer}`);
        }
      } catch (error) {
        logger.warn(`Error fetching facts for ${member}:`, error as Error);
        // Continue with other members even if this one fails
      }
    }
    
    // 5. Generate description suggestion using Bedrock
    const suggestion = await generateGroupDescription({
      groupId,
      members: groupMembers,
      currentDescription,
      customCategories,
      facts
    });
    
    return successResponse({
      success: true,
      groupId,
      suggestion,
      currentDescription
    });
  } catch (err) {
    logger.error('Error suggesting group description:', err as Error);
    return errorResponse('Failed to suggest group description', 500);
  }
}