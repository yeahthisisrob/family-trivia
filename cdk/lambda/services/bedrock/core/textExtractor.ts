// File: lambda/services/bedrock/core/textExtractor.ts
// Purpose: Utility to extract text content from various model response formats

import { extractJsonFromResponse } from './responseParser';
import { logger } from '../../logger';

/**
 * Extracts text content from a Bedrock response buffer, handling various model formats
 * @param responseBuffer - The raw response buffer from Bedrock
 * @param modelId - The model ID used for the request
 * @param fieldName - Optional field name to extract from JSON responses (e.g., 'summary', 'description')
 * @returns The extracted text content
 */
export function extractTextContent(
  responseBuffer: Buffer,
  modelId: string,
  fieldName?: string
): string {
  try {
    // First, try the universal response parser
    const parsedResponse = extractJsonFromResponse(responseBuffer, modelId);
    
    // Check if we got raw text (when JSON parsing failed)
    if (parsedResponse.rawText) {
      return parsedResponse.rawText.trim();
    }
    
    // Check if it's a direct string response
    if (typeof parsedResponse === 'string') {
      return parsedResponse.trim();
    }
    
    // Model returned JSON, try to extract the specified field or common fields
    if (typeof parsedResponse === 'object' && parsedResponse !== null) {
      // Try the specified field first
      if (fieldName && parsedResponse[fieldName]) {
        return String(parsedResponse[fieldName]).trim();
      }
      
      // Try common field names
      const commonFields = ['text', 'content', 'summary', 'description', 'answer', 'response'];
      for (const field of commonFields) {
        if (parsedResponse[field]) {
          return String(parsedResponse[field]).trim();
        }
      }
      
      // If no known fields, stringify the object
      // Check if it's an array of insights
      if (Array.isArray(parsedResponse)) {
        return JSON.stringify({ insights: parsedResponse });
      }
      return JSON.stringify(parsedResponse);
    }
    
    // Fallback to empty string
    return '';
    
  } catch (error) {
    // If the universal parser failed, try direct parsing for different model formats
    try {
      const responseText = responseBuffer.toString('utf-8');
      const responseJson = JSON.parse(responseText);
      
      // Try Claude format first (content[0].text)
      if (responseJson.content && Array.isArray(responseJson.content) && responseJson.content[0]?.text) {
        return responseJson.content[0].text.trim();
      }
      
      // Try alternative Claude format (just content.text)
      if (responseJson.content?.text) {
        return responseJson.content.text.trim();
      }
      
      // Try Llama format
      if (responseJson.generation) {
        return responseJson.generation.trim();
      }
      
      // Try looking for the field directly
      if (fieldName && responseJson[fieldName]) {
        return String(responseJson[fieldName]).trim();
      }
      
      // Try common field names at root level
      const commonFields = ['text', 'content', 'summary', 'description', 'answer', 'response', 'completion'];
      for (const field of commonFields) {
        if (responseJson[field]) {
          return String(responseJson[field]).trim();
        }
      }
      
      // If we have a valid JSON but no known fields, return stringified
      return JSON.stringify(responseJson);
      
    } catch (parseError) {
      logger.debug('Failed to parse response as JSON, returning raw text', {
        error: parseError instanceof Error ? parseError.message : String(parseError),
        modelId,
        bufferLength: responseBuffer.length
      });
      
      // Last resort: return raw text
      return responseBuffer.toString('utf-8').trim();
    }
  }
}