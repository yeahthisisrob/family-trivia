import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  getCommentThread,
  addComment,
  getCommentCounts,
  getAllThreads,
} from '../services/commentsService';
import { logger } from '../services/logger';
import { CommentContentType, AddCommentRequest } from '../types/comments';
import { successResponse, errorResponse } from '../config';

/**
 * Resolve contentType from query params or path.
 * New endpoints use ?contentType=fact|trivia.
 * Legacy endpoints use the path: /fact-comments → fact, /trivia-comments → trivia.
 */
function resolveContentType(event: APIGatewayProxyEvent): CommentContentType | null {
  const param = event.queryStringParameters?.contentType;
  if (param === 'fact' || param === 'trivia' || param === 'album' || param === 'arcade') {
    return param;
  }

  // Legacy path detection
  if (event.path.includes('fact-comments')) return 'fact';
  if (event.path.includes('trivia-comments')) return 'trivia';

  return null;
}

/**
 * Resolve contentId from query params.
 * New endpoints use ?contentId=X.
 * Legacy endpoints use ?factId=X or ?triviaId=X.
 */
function resolveContentId(event: APIGatewayProxyEvent, contentType: CommentContentType): string | undefined {
  return (
    event.queryStringParameters?.contentId ||
    event.queryStringParameters?.factId ||
    event.queryStringParameters?.triviaId
  );
}

/**
 * GET /comments?contentType=fact&contentId=X
 * GET /comments?contentType=fact&getAll=true
 * Also handles legacy GET /fact-comments and GET /trivia-comments
 */
export async function getCommentsHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contentType = resolveContentType(event);
    if (!contentType) {
      return errorResponse('Missing or invalid contentType parameter (fact|trivia)', 400);
    }

    const getAll = event.queryStringParameters?.getAll === 'true';

    if (getAll) {
      logger.info(`Getting all ${contentType} comment threads`);
      const threads = await getAllThreads(contentType);
      logger.info(`Retrieved ${threads.length} ${contentType} comment threads`);
      return successResponse({ threads });
    }

    const contentId = resolveContentId(event, contentType);
    if (!contentId) {
      return errorResponse('Missing contentId parameter', 400);
    }

    logger.info(`Getting comments for ${contentType}/${contentId}`);
    const thread = await getCommentThread(contentType, contentId);
    logger.info(`Retrieved ${thread.comments.length} comments for ${contentType}/${contentId}`);

    return successResponse({ thread });
  } catch (error) {
    logger.error(`Error retrieving comments: ${(error as Error).message}`);
    return errorResponse('Error retrieving comments', 500, (error as Error).message);
  }
}

/**
 * GET /comments/counts?contentType=fact&ids=id1,id2,id3
 * Lightweight batch endpoint for comment count badges.
 */
export async function getCommentCountsHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const contentType = resolveContentType(event);
    if (!contentType) {
      return errorResponse('Missing or invalid contentType parameter (fact|trivia)', 400);
    }

    const idsParam = event.queryStringParameters?.ids;
    if (!idsParam) {
      return errorResponse('Missing ids parameter', 400);
    }

    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length === 0) {
      return successResponse({ counts: {} });
    }

    logger.info(`Getting comment counts for ${ids.length} ${contentType} items`);
    const result = await getCommentCounts(contentType, ids);

    return successResponse({ counts: result.counts, commenters: result.commenters });
  } catch (error) {
    logger.error(`Error getting comment counts: ${(error as Error).message}`);
    return errorResponse('Error getting comment counts', 500, (error as Error).message);
  }
}

/**
 * POST /comments
 * Body: { contentType, contentId, userId, text, parentId? }
 * Also handles legacy POST /fact-comments and POST /trivia-comments
 */
export async function addCommentHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return errorResponse('Missing request body', 400);
    }

    const body = JSON.parse(event.body);

    // Resolve contentType from body or path (legacy)
    const allowed: CommentContentType[] = ['fact', 'trivia', 'album', 'arcade'];
    let contentType: CommentContentType | null = allowed.includes(body.contentType) ? body.contentType : null;
    if (!contentType) {
      if (event.path.includes('fact-comments')) contentType = 'fact';
      else if (event.path.includes('trivia-comments')) contentType = 'trivia';
    }
    if (!contentType) {
      return errorResponse('Missing or invalid contentType in request body', 400);
    }

    // Resolve contentId from body (new: contentId, legacy: factId/triviaId)
    const contentId = body.contentId || body.factId || body.triviaId;
    if (!contentId) {
      return errorResponse('Missing contentId in request body', 400);
    }

    const { userId, text, parentId } = body;
    if (!userId || !text) {
      return errorResponse('Missing required fields: userId and text are required', 400);
    }

    const request: AddCommentRequest = { contentType, contentId, userId, text, parentId };
    logger.info(`Adding comment to ${contentType}/${contentId} by ${userId}`);

    const result = await addComment(request);
    logger.info(`Comment added: ${result.comment.id}`);

    return successResponse(result, 201);
  } catch (error) {
    logger.error(`Error adding comment: ${(error as Error).message}`);
    return errorResponse('Error adding comment', 500, (error as Error).message);
  }
}
