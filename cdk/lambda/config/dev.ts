// Development config
import { CommonConfig } from './types';

const devConfig: CommonConfig = {
  bucket: 'dev-family-trivia-bucket',
  region: 'us-east-1',
  modelId: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
  corsHeaders: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
    'Access-Control-Allow-Methods': 'OPTIONS,GET,POST,PUT,DELETE',
    'Access-Control-Allow-Credentials': 'true'
  },
  // Use mock data for local development
  mockData: {
    // Add mock data for local development here
    userCanAnswer: true,
    userAnswerHistory: [],
    familyHierarchy: {
      family: {
        sides: {
          'john': {
            id: 'john',
            name: 'John',
            color: '#1976d2',
            groups: ['group1', 'group3']
          },
          'jane': {
            id: 'jane',
            name: 'Jane',
            color: '#6200ea', 
            groups: ['group2', 'group4']
          }
        }
      }
    }
  }
};

export default devConfig;