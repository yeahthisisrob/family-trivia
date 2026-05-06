// File: lambda/routes/triviaBankAdmin.ts
// Purpose: Admin endpoints for trivia bank management.

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { successResponse, errorResponse } from '../config';
import { logger } from '../services/logger';
import { requireAdmin } from '../services/adminAuth';
import {
  getBankStats,
  browseQuestions,
  deleteQuestion,
  importFromOpenTDB,
  importFromJService,
  generateLocalTrivia,
  updateMetadata,
} from '../services/triviaBankService';

function getAdminId(event: APIGatewayProxyEvent): string | undefined {
  return event.queryStringParameters?.adminUserId
    || (event.body ? JSON.parse(event.body).adminUserId : undefined);
}

/**
 * GET /admin/trivia-bank/stats — dashboard stats
 */
export async function triviaBankStats(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const authErr = await requireAdmin(getAdminId(event));
  if (authErr) return errorResponse(authErr, 403);

  try {
    const stats = await getBankStats();
    return successResponse(stats);
  } catch (err) {
    logger.error('Error getting bank stats', { error: err });
    return errorResponse('Failed to get stats', 500);
  }
}

/**
 * GET /admin/trivia-bank/browse — browse questions
 */
export async function triviaBankBrowse(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const authErr = await requireAdmin(getAdminId(event));
  if (authErr) return errorResponse(authErr, 403);

  const { category, difficulty, offset, limit } = event.queryStringParameters || {};
  if (!category || !difficulty) return errorResponse('Missing category or difficulty', 400);

  try {
    const result = await browseQuestions(
      category, difficulty,
      parseInt(offset || '0'), parseInt(limit || '20'),
    );
    return successResponse(result);
  } catch (err) {
    logger.error('Error browsing questions', { error: err });
    return errorResponse('Failed to browse', 500);
  }
}

/**
 * DELETE /admin/trivia-bank/question — delete a question
 */
export async function triviaBankDelete(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const authErr = await requireAdmin(body.adminUserId);
  if (authErr) return errorResponse(authErr, 403);

  const { category, difficulty, questionText } = body;
  if (!category || !difficulty || !questionText) {
    return errorResponse('Missing category, difficulty, or questionText', 400);
  }

  const deleted = await deleteQuestion(category, difficulty, questionText);
  return successResponse({ deleted });
}

/**
 * POST /admin/trivia-bank/import — import from external source
 */
export async function triviaBankImport(
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const authErr = await requireAdmin(body.adminUserId);
  if (authErr) return errorResponse(authErr, 403);

  const { source, category, difficulty, count } = body;
  if (!source || !category || !difficulty) {
    return errorResponse('Missing source, category, or difficulty', 400);
  }

  try {
    let result;
    switch (source) {
      case 'opentdb':
        result = await importFromOpenTDB(category, difficulty, count || 50);
        break;
      case 'jservice':
        result = await importFromJService(category, difficulty, count || 50);
        break;
      case 'ai-rochester':
        result = await generateLocalTrivia('Rochester, NY', difficulty, count || 20);
        break;
      case 'ai-brooklyn':
        result = await generateLocalTrivia('Brooklyn, NY', difficulty, count || 20);
        break;
      case 'ai-custom':
        result = await generateLocalTrivia(category, difficulty, count || 20);
        break;
      default:
        return errorResponse(`Unknown source: ${source}`, 400);
    }

    // Update metadata after import
    await updateMetadata();

    return successResponse(result);
  } catch (err) {
    logger.error('Import error', { source, category, error: err });
    return errorResponse('Import failed', 500);
  }
}
