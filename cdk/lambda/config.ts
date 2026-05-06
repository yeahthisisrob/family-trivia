import { APIGatewayProxyResult } from 'aws-lambda';

// Environment variables
export const BUCKET = process.env.BUCKET_NAME!;
export const REGION = process.env.AWS_REGION || 'us-east-1';

// Model configuration - supports multiple models
export const AVAILABLE_MODELS = {
  CLAUDE_SONNET_4: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  CLAUDE_HAIKU_4_5: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
} as const;

export const MODEL_ID = process.env.BEDROCK_MODEL_ID || AVAILABLE_MODELS.CLAUDE_SONNET_4;

// Service-specific model selection
type ServiceModelMap = {
  MEMBER_SUMMARIES: string;
  ROAST_SUMMARIES: string;
  FUN_FACTS: string;
  CUSTOM_CATEGORIES: string;
  GROUP_DESCRIPTIONS: string;
  PERSONAL_QUESTIONS: string;
  QUESTION_GENERATION: string;
  FACT_CHECKERS: readonly string[];
};

export const SERVICE_MODELS: ServiceModelMap = {
  // Sonnet 4 for most generation tasks
  MEMBER_SUMMARIES: AVAILABLE_MODELS.CLAUDE_SONNET_4,
  FUN_FACTS: AVAILABLE_MODELS.CLAUDE_SONNET_4,
  CUSTOM_CATEGORIES: AVAILABLE_MODELS.CLAUDE_SONNET_4,
  GROUP_DESCRIPTIONS: AVAILABLE_MODELS.CLAUDE_SONNET_4,
  PERSONAL_QUESTIONS: AVAILABLE_MODELS.CLAUDE_SONNET_4,
  QUESTION_GENERATION: AVAILABLE_MODELS.CLAUDE_SONNET_4,

  // Haiku 4.5 for roasts (snarkier, less filtered) and fact checking (fast + cheap)
  ROAST_SUMMARIES: AVAILABLE_MODELS.CLAUDE_HAIKU_4_5,
  FACT_CHECKERS: [AVAILABLE_MODELS.CLAUDE_HAIKU_4_5],
};

/**
 * Gets the appropriate model ID for a specific service
 */
export function getModelForService(serviceName: keyof ServiceModelMap): string {
  const model = SERVICE_MODELS[serviceName];
  // For fact checkers, return a random one
  if (Array.isArray(model)) {
    return model[Math.floor(Math.random() * model.length)];
  }
  return model as string;
}

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
      ...CORS_HEADERS
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