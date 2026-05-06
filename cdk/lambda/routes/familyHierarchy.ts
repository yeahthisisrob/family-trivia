// File: lambda/routes/familyHierarchy.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getJson } from '../services/s3';
import { successResponse, errorResponse } from '../config';
import { S3_PATHS } from '../constants';
import { logger } from '../services/logger';

// Type definitions for hierarchy data
interface Person {
  name: string;
  groupId: string;
  familySide?: string;
  [key: string]: any;
}

interface Group {
  name: string;
  description?: string;
  [key: string]: any;
}

interface FamilySides {
  [key: string]: {
    name: string;
    color: string;
    [key: string]: any;
  };
}

interface HierarchyData {
  family: {
    people: Record<string, Person>;
    groups: Record<string, Group>;
    sides?: FamilySides;
    [key: string]: any;
  };
  [key: string]: any;
}

/**
 * Retrieves the family hierarchy data from S3
 * Now provides group descriptions and any additional metadata needed by the frontend
 */
export async function getFamilyHierarchy(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Get the hierarchy data from S3
    const rawHierarchyData = await getJson<HierarchyData>(S3_PATHS.FAMILY_HIERARCHY);

    if (!rawHierarchyData) {
      return errorResponse('Family hierarchy data not found', 404);
    }

    // Validate and ensure complete data structure
    const hierarchyData: HierarchyData = {
      ...rawHierarchyData,
      family: {
        ...rawHierarchyData.family,
        people: rawHierarchyData.family?.people || {},
        groups: rawHierarchyData.family?.groups || {},
        sides: rawHierarchyData.family?.sides || {}
      }
    };

    // Log if we had to repair the structure
    if (!rawHierarchyData.family?.people || !rawHierarchyData.family?.groups) {
      logger.warn('S3 hierarchy data was incomplete, structure validated and repaired:', {
        hadPeople: Boolean(rawHierarchyData.family?.people),
        hadGroups: Boolean(rawHierarchyData.family?.groups),
        hadFamily: Boolean(rawHierarchyData.family)
      });
    }

    // Extract group descriptions for easier access in the frontend
    const groupDescriptions: Record<string, string> = {};

    if (hierarchyData.family && hierarchyData.family.groups) {
      Object.entries(hierarchyData.family.groups).forEach(([groupId, groupData]) => {
        if (groupData.description) {
          groupDescriptions[groupId] = groupData.description;
        }
      });
    }

    // Return the hierarchy data with additional metadata
    return successResponse({
      hierarchy: hierarchyData,
      groupDescriptions,
      familySides: hierarchyData.family.sides || {},
      success: true
    });
  } catch (err) {
    logger.error('Error fetching family hierarchy:', err as Error);
    return errorResponse('Failed to retrieve family hierarchy data', 500);
  }
}