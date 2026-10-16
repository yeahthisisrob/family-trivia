import type { APIGatewayProxyResult } from 'aws-lambda';

// Environment variables
export const BUCKET = process.env.BUCKET_NAME ?? '';
export const REGION = process.env.AWS_REGION || 'us-east-1';

/**
 * Claude models on Bedrock, by role rather than by name, so moving to a new
 * model is a config change (BEDROCK_MODEL_WRITER / BEDROCK_MODEL_FAST, set
 * from infra/cdk.config.json). Defaults are models most accounts can call;
 * newer ones need access enabled in the Bedrock console first.
 * Models reach end of life; when one does, every AI feature fails with
 * "This model version has reached the end of its life".
 */
export const MODELS = {
  /** Writing: questions, summaries, stories. */
  WRITER:
    process.env.BEDROCK_MODEL_WRITER ||
    process.env.BEDROCK_MODEL_ID ||
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  /** Fast and cheap: fact checks, roasts, game moves, second opinions. */
  FAST: process.env.BEDROCK_MODEL_FAST || 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
} as const;

export const MODEL_ID = MODELS.WRITER;

// Response headers. API routes through CloudFront (same-origin) but
// API Gateway proxy integration still needs these to pass responses through.
export const CORS_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,Cache-Control',
  'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
};

// Feature flags
export const FEATURE_FLAGS = {
  CASINO_RUSH_ENABLED: true,
  SLOT_MACHINE_ENABLED: true,
  CUSTOM_CATEGORIES_ENABLED: true,
} as const;

// Helper functions
export function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function jsonResponse(body: any, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(body),
  };
}

/** Wrap data in a standard success envelope: { ok: true, data } */
export function successResponse<T>(data: T, statusCode = 200): APIGatewayProxyResult {
  return jsonResponse({ ok: true, data }, statusCode);
}

/** Return a standard error envelope: { ok: false, error, details? } */
export function errorResponse(
  error: string,
  statusCode = 400,
  details?: string,
  errorType?: string,
): APIGatewayProxyResult {
  return jsonResponse({ ok: false, error, details, errorType }, statusCode);
}
