// Production config
import { CommonConfig } from './types';

// Get environment variables
const bucketName = process.env.BUCKET_NAME;
const region = process.env.AWS_REGION || 'us-east-1';
const modelId = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-20250514-v1:0';

// Validate required environment variables
if (!bucketName) {
  console.warn('Warning: BUCKET_NAME environment variable is not set');
}

const prodConfig: CommonConfig = {
  bucket: bucketName,
  region,
  modelId,
  corsHeaders: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
    'Access-Control-Allow-Credentials': 'true'
  },
  // No mock data in production
  mockData: null
};

export default prodConfig;