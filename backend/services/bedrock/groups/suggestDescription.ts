import { modelFor } from '../core/models';
// File: lambda/services/bedrock/groups/suggestDescription.ts

import { logger } from '../../logger';
import { askText } from '../core/converse';

interface GroupData {
  groupId: string;
  members: string[];
  currentDescription: string;
  customCategories: string[];
  facts: string[];
}

/**
 * Builds a prompt for generating a group description based on group data
 */
export function buildGroupDescriptionPrompt(groupData: GroupData): string {
  const { groupId, members, currentDescription, customCategories, facts } = groupData;

  // Format custom categories
  const categoriesText =
    customCategories.length > 0
      ? `Custom trivia categories created by group members:\n${customCategories.join('\n')}`
      : 'No custom trivia categories created yet.';

  // Format interesting facts (limit to 5 most recent)
  const factsText =
    facts.length > 0
      ? `Recent personal facts shared by group members:\n${facts.slice(0, 5).join('\n')}`
      : 'No personal facts shared yet.';

  return `
You are helping to write a fun, engaging group description for a family trivia game. The group is: "${groupId}".

Group members: ${members.join(', ')}

Current description: "${currentDescription || 'No description yet'}"

${categoriesText}

${factsText}

Task: Write a new group description that captures the essence of this group based on the information above, that is
friendly and engaging.

If there's not much group activity information, be creative based on the group name and members.

Return ONLY the new description text - no explanations, formatting, or quotes. THE RETURN RESPONSE MUST BE UNDER 120 CHARACTERS IN LENGTH.
`;
}

/**
 * Generates a suggested group description using Bedrock
 */
export async function generateGroupDescription(groupData: GroupData): Promise<string> {
  try {
    // Build the prompt
    const prompt = buildGroupDescriptionPrompt(groupData);

    logger.info('Generating group description', {
      groupId: groupData.groupId,
      memberCount: groupData.members.length,
    });

    // Send to Bedrock with a small token limit since we only need a short description
    const description = await askText({
      task: 'summaries',
      prompt,
      maxTokens: 256,
      temperature: 0.8,
      model: modelFor('summaries'),
    });

    // If the description is too long, truncate it
    return description.length > 120 ? `${description.substring(0, 117)}...` : description;
  } catch (error) {
    logger.error('Error generating group description', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      groupId: groupData.groupId,
    });
    throw new Error('Failed to generate group description suggestion');
  }
}
