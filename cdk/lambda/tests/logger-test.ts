import { logger } from '../services/logger';
import { getJson, putJson, listObjects, fileExists } from '../services/s3';

// Mock APIGateway event
const mockEvent = {
  httpMethod: 'GET',
  path: '/test-path',
  requestContext: {
    requestId: 'test-request-id',
    identity: {
      sourceIp: '127.0.0.1'
    }
  }
};

// Add persistent attributes instead of trying to use addContext
logger.appendKeys({
  requestId: mockEvent.requestContext?.requestId,
  path: mockEvent.path,
  method: mockEvent.httpMethod,
  sourceIp: mockEvent.requestContext?.identity?.sourceIp,
});

async function testLogger() {
  // Set log level to DEBUG for testing
process.env.LOG_LEVEL = 'DEBUG';

// Test different log levels
  logger.info('This is an info log', { testKey: 'testValue' });
  logger.warn('This is a warning log', { warnKey: 'warnValue' });
  logger.error('This is an error log', { errorKey: 'errorValue' });
  logger.debug('This is a debug log', { debugKey: 'debugValue' });
  
  // Test with a simulated error
  try {
    throw new Error('Test error');
  } catch (error: any) {
    logger.error('Caught an error', { 
      error: error.message,
      stack: error.stack
    });
  }
  
  // Test with structured data
  logger.info('User activity logged', {
    userId: 'test-user-id',
    action: 'login',
    timestamp: new Date().toISOString()
  });
  
  // Test with a large nested object
  const nestedObject = {
    level1: {
      level2: {
        level3: {
          value: 'nested value',
          array: [1, 2, 3, 4, 5]
        }
      }
    }
  };
  
  logger.info('Complex object log', { nestedObject });
  
  console.log('Logger test completed - check CloudWatch logs in AWS to verify structured logging');
}

// Run the test
testLogger();