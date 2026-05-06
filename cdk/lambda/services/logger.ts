import { Logger, LogLevel } from '@aws-lambda-powertools/logger';

// Get log level from environment or use INFO as default
const logLevelFromEnv = process.env.LOG_LEVEL as keyof typeof LogLevel;
const resolvedLogLevel = logLevelFromEnv ? LogLevel[logLevelFromEnv] : LogLevel.INFO;

export const logger = new Logger({
  serviceName: 'family-game',
  logLevel: resolvedLogLevel,
  persistentLogAttributes: {
    application: 'family-game',
    environment: process.env.ENVIRONMENT || 'development',
  },
});