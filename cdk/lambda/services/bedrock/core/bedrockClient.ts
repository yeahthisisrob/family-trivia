// File: lambda/services/bedrock/core/bedrockClient.ts

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { REGION, MODEL_ID, AVAILABLE_MODELS } from '../../../config';
import { logger } from '../../logger';

/**
 * Initializes and returns a BedrockRuntimeClient instance
 */
// Track token usage to prevent throttling
const tokenBucket = {
  tokens: 100000, // Initial token allocation
  lastRefill: Date.now(),
  maxTokens: 100000,
  refillRate: 10000, // Tokens per second to refill
};

// Function to check and consume tokens from the bucket
function consumeTokens(tokenCount: number): boolean {
  const now = Date.now();
  const timePassed = (now - tokenBucket.lastRefill) / 1000; // seconds
  
  // Refill the bucket based on time passed
  tokenBucket.tokens = Math.min(
    tokenBucket.maxTokens,
    tokenBucket.tokens + timePassed * tokenBucket.refillRate
  );
  
  tokenBucket.lastRefill = now;
  
  // Check if we have enough tokens
  if (tokenBucket.tokens >= tokenCount) {
    tokenBucket.tokens -= tokenCount;
    return true; // We can consume these tokens
  }
  
  return false; // Not enough tokens available
}

export function createBedrockClient(): BedrockRuntimeClient {
  return new BedrockRuntimeClient({
    region: REGION,
    maxAttempts: 5,
    // Default retry settings work best
  });
}

/**
 * Determines if the current model is Claude-based
 */
function isClaudeModel(modelId: string): boolean {
  return modelId.includes('anthropic.claude') || modelId.includes('us.anthropic.claude');
}

/**
 * Determines if the current model is Llama-based
 */
function isLlamaModel(modelId: string): boolean {
  return modelId.includes('meta.llama') || modelId.includes('us.meta.llama');
}

/**
 * Formats prompt for Llama models (adds instruction formatting)
 */
function formatLlamaPrompt(prompt: string): string {
  // Llama models work better with explicit instruction formatting
  // Add system instruction and user query formatting
  return `<|begin_of_text|><|start_header_id|>system<|end_header_id|>

You are a helpful assistant that provides accurate and useful responses. Follow the instructions carefully and provide the exact format requested.

<|eot_id|><|start_header_id|>user<|end_header_id|>

${prompt}

<|eot_id|><|start_header_id|>assistant<|end_header_id|>

`;
}

/**
 * Creates request body based on model type
 */
function createRequestBody(prompt: string, maxTokens: number, temperature: number, modelId: string): any {
  if (isClaudeModel(modelId)) {
    // Claude models use the Messages API format
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    };
  } else if (isLlamaModel(modelId)) {
    // Llama models use the Text Generation format with special formatting
    const formattedPrompt = formatLlamaPrompt(prompt);
    return {
      prompt: formattedPrompt,
      max_gen_len: maxTokens,
      temperature,
      top_p: 0.9,
    };
  } else {
    // Default to Claude format for unknown models
    logger.warn('Unknown model type, defaulting to Claude format', { modelId });
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      temperature,
      messages: [
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }],
        },
      ],
    };
  }
}

/**
 * Sends a prompt to Bedrock and returns the raw response body stream
 */
export async function invokeBedrockPrompt(
  prompt: string, 
  maxTokens = 512, 
  temperature = 0.7,
  context: Record<string, any> = {},
  overrideModelId?: string
) {
  const activeModelId = overrideModelId || MODEL_ID;
  
  logger.appendKeys({
    promptLength: prompt.length,
    maxTokens,
    temperature,
    model: activeModelId,
    modelType: isClaudeModel(activeModelId) ? 'claude' : isLlamaModel(activeModelId) ? 'llama' : 'unknown',
    ...context
  });

  logger.info('Initializing Bedrock client');
  const client = createBedrockClient();

  const requestBody = createRequestBody(prompt, maxTokens, temperature, activeModelId);

  logger.info('Invoking Bedrock model', {
    promptFirstChars: prompt.slice(0, 100) + (prompt.length > 100 ? '...' : '')
  });

  try {
    // Estimate token usage - roughly 1 token per 3 characters for input,
    // plus the maximum output tokens requested
    const estimatedInputTokens = Math.ceil(prompt.length / 3);
    const estimatedTotalTokens = estimatedInputTokens + maxTokens;
    
    // Check if we have enough tokens in our bucket
    if (!consumeTokens(estimatedTotalTokens)) {
      logger.warn('Token bucket throttling', {
        estimatedInputTokens,
        maxOutputTokens: maxTokens,
        totalTokens: estimatedTotalTokens,
        availableTokens: tokenBucket.tokens
      });
      
      throw {
        name: 'ThrottlingException',
        message: 'Request throttled by token bucket to prevent API rate limits',
        $metadata: { httpStatusCode: 429 }
      };
    }
    
    const command = new InvokeModelCommand({
      modelId: activeModelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody),
    });

    const response = await client.send(command);

    if (!response.body) {
      logger.error('Empty response body from Bedrock');
      throw new Error('Empty response body from Bedrock');
    }

    logger.info('Received response from Bedrock');
    return response.body;
  } catch (err: any) {
    // Special handling for the inference profile error
    if (err.message && err.message.includes("on-demand throughput isn't supported")) {
      logger.error('Bedrock inference profile error', {
        error: err.message,
        errorName: err.name,
        statusCode: err.$metadata?.httpStatusCode,
        requestId: err.$metadata?.requestId,
        solution: "Use an inference profile ID by adding region prefix (e.g., 'us.') to model ID"
      });
      
      // Throw a more helpful error
      throw new Error(`Bedrock model requires an inference profile. Update MODEL_ID in config.ts to use format: 'us.${activeModelId.replace(/^us\./, '')}'`);
    } 
    // Handle API version errors
    else if (err.name === 'ValidationException' && err.message && err.message.includes("Invalid API version")) {
      logger.error('Bedrock API version error', {
        error: err.message,
        errorName: err.name,
        statusCode: err.$metadata?.httpStatusCode,
        requestId: err.$metadata?.requestId,
        solution: "Update anthropic_version parameter in requestBody"
      });
      
      // Throw a more helpful error
      throw new Error(`Invalid Bedrock API version. Try using 'bedrock-2023-05-31': ${err.message}`);
    }
    // Handle throttling errors (both from our token bucket and from AWS)
    else if (err.name === 'ThrottlingException' || 
            (err.message && (err.message.includes("Too many tokens") || 
                            err.message.includes("Rate exceeded") ||
                            err.message.includes("throttled")))) {
      
      logger.error('Bedrock throttling error', {
        error: err.message,
        errorName: err.name,
        statusCode: err.$metadata?.httpStatusCode,
        requestId: err.$metadata?.requestId,
        solution: "Reduce request frequency or implement exponential backoff"
      });
      
      // Add more context to the error
      const enhancedError = new Error(`Bedrock API rate limit exceeded. ${err.message}`);
      enhancedError.name = 'ThrottlingException';
      throw enhancedError;
    } 
    else {
      logger.error('Error invoking Bedrock model', {
        error: err.message,
        errorName: err.name,
        statusCode: err.$metadata?.httpStatusCode,
        requestId: err.$metadata?.requestId
      });
      throw err;
    }
  } finally {
    // Clean up context-specific log attributes
    logger.removeKeys([
      'promptLength', 'maxTokens', 'temperature', 'model', 
      ...Object.keys(context)
    ]);
  }
}
