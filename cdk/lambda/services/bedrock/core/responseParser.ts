// File: lambda/services/bedrock/core/responseParser.ts

import { Readable } from 'stream';
import { logger } from '../../logger';
import { MODEL_ID } from '../../../config';

/**
 * Collects the response body stream into a single Buffer
 */
export async function collectResponseBody(bodyStream: any): Promise<Buffer> {
  logger.debug('Collecting response body stream');
  const chunks: Uint8Array[] = [];

  try {
    if (bodyStream instanceof Readable) {
      logger.debug('Processing response as Readable stream');
      for await (const chunk of bodyStream) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      }
    } else if (typeof bodyStream.transformToByteArray === 'function') {
      logger.debug('Processing response using transformToByteArray method');
      chunks.push(Buffer.from(await bodyStream.transformToByteArray()));
    } else if (typeof bodyStream.arrayBuffer === 'function') {
      logger.debug('Processing response using arrayBuffer method');
      chunks.push(Buffer.from(await bodyStream.arrayBuffer()));
    } else if (bodyStream instanceof Uint8Array) {
      logger.debug('Processing response as Uint8Array');
      chunks.push(Buffer.from(bodyStream));
    } else {
      logger.debug('Processing response as string');
      chunks.push(Buffer.from(String(bodyStream)));
    }

    const buffer = Buffer.concat(chunks);
    logger.debug('Response body collected', { 
      byteLength: buffer.length 
    });
    return buffer;
  } catch (err: any) {
    logger.error('Error collecting response body', { 
      error: err.message,
      bodyStreamType: typeof bodyStream
    });
    throw err;
  }
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
 * Extracts text content from different model response formats
 */
function extractTextFromResponse(respBody: any, modelId: string): string {
  if (isClaudeModel(modelId)) {
    // Claude models use the Messages API format
    const text = respBody.content?.[0]?.text;
    if (!text) {
      logger.error('No text content found in Claude response', {
        responseKeys: Object.keys(respBody),
        content: respBody.content
      });
      throw new Error('No text content found in Claude response');
    }
    return text;
  } else if (isLlamaModel(modelId)) {
    // Llama models use the Text Generation format
    const text = respBody.generation;
    
    // Log detailed response info for debugging
    logger.debug('Llama response details', {
      generation: respBody.generation,
      promptTokenCount: respBody.prompt_token_count,
      generationTokenCount: respBody.generation_token_count,
      stopReason: respBody.stop_reason,
      responseKeys: Object.keys(respBody)
    });
    
    if (!text || text.trim() === '') {
      logger.error('Empty generation content in Llama response', {
        responseKeys: Object.keys(respBody),
        generation: respBody.generation,
        promptTokenCount: respBody.prompt_token_count,
        generationTokenCount: respBody.generation_token_count,
        stopReason: respBody.stop_reason
      });
      throw new Error('Empty generation content in Llama response - check prompt format and content filters');
    }
    return text;
  } else {
    // Try both formats for unknown models
    logger.warn('Unknown model type, trying multiple response formats', { modelId });
    
    // Try Claude format first
    if (respBody.content?.[0]?.text) {
      return respBody.content[0].text;
    }
    
    // Try Llama format
    if (respBody.generation) {
      return respBody.generation;
    }
    
    // Fallback to raw response
    logger.error('No recognized text content found in response', {
      responseKeys: Object.keys(respBody)
    });
    throw new Error('No recognized text content found in response');
  }
}

/**
 * Extracts and parses a JSON object from the Bedrock response buffer
 */
export function extractJsonFromResponse(responseBuffer: Buffer, modelId?: string): any {
  const activeModelId = modelId || MODEL_ID;
  
  logger.debug('Extracting JSON from Bedrock response', {
    responseSize: responseBuffer.length,
    modelId: activeModelId
  });
  
  try {
    // First convert buffer to string
    const out = responseBuffer.toString('utf-8');
    
    // Parse the main response
    const respBody = JSON.parse(out);
    logger.debug('Parsed main Bedrock response');
    
    // Extract text content based on model type
    const text = extractTextFromResponse(respBody, activeModelId);
    
    // Look for JSON object in the text content
    logger.debug('Searching for JSON object in response text', {
      textLength: text.length
    });
    
    const match = text.match(/(\{[\s\S]*\})/);
    const jsonText = match ? match[1] : text;
    
    // Try to parse the extracted JSON
    try {
      const result = JSON.parse(jsonText);
      logger.debug('Successfully extracted JSON from response');
      return result;
    } catch (jsonError: any) {
      logger.debug('Response contains raw text instead of JSON, returning as rawText', {
        textPreview: jsonText.slice(0, 200) + (jsonText.length > 200 ? '...' : '')
      });
      // Return the raw text content if JSON parsing fails
      // But check if the text itself might be a JSON array
      try {
        // Remove any trailing commas or whitespace that might cause parsing issues
        const cleanedText = text.trim().replace(/,\s*$/, '');
        const textAsJson = JSON.parse(cleanedText);
        if (Array.isArray(textAsJson)) {
          logger.debug('Text is actually a JSON array, returning as parsed');
          return textAsJson;
        }
        return textAsJson;
      } catch (e) {
        // Really is raw text
        return { rawText: text };
      }
    }
  } catch (error: any) {
    logger.error('Error parsing Bedrock response', { 
      error: error.message,
      responsePreview: responseBuffer.toString('utf-8').slice(0, 500) + '...'
    });
    
    // Provide detailed logging for debugging
    try {
      const responseText = responseBuffer.toString('utf-8');
      logger.error('Response content details', {
        length: responseText.length,
        preview: responseText.slice(0, 500),
        isValidJSON: isJsonString(responseText)
      });
    } catch (logError) {
      logger.error('Failed to log response details');
    }
    
    throw error;
  }
}

// Helper function to check if a string is valid JSON
function isJsonString(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
}
