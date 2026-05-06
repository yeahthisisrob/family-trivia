// File: frontend/src/config.ts
import { createLogger, LogLevel, setLogLevel } from './utils/logger';

/**
 * Application configuration
 *
 * This module handles loading application configuration from config.json
 * and provides logging configuration for the application.
 */

/**
 * Application configuration interface
 */
export interface FrontendConfig {
  REACT_APP_API_URL: string;
  REACT_APP_AUDIO_URL?: string;
  REACT_APP_GOOGLE_CLIENT_ID?: string;
}

// Initialize logger
const logger = createLogger('Config');

// Cache loaded configuration
let _cfg: FrontendConfig | undefined;

/**
 * Configure application logging
 *
 * This function configures the logging level for the application.
 * In development mode, logging is set to INFO by default.
 * In production mode, logging is set to ERROR by default.
 *
 * To use the logger in any file:
 * ```typescript
 * import { createLogger } from './utils/logger';
 *
 * const logger = createLogger('ModuleName');
 *
 * // Then use logger methods:
 * logger.debug('Debug message');
 * logger.info('Info message');
 * logger.warn('Warning message');
 * logger.error('Error message', errorObject);
 * ```
 *
 * @param level LogLevel to set (NONE, ERROR, WARN, INFO, DEBUG)
 */
// Track if logging has been configured to avoid duplicate logs
let loggingConfigured = false;

export function configureLogging(level?: LogLevel): void {
  // Skip if already configured to avoid duplicate messages
  if (loggingConfigured) return;

  // If no level specified, use ENV-based defaults
  if (level === undefined) {
    level = import.meta.env.PROD ? LogLevel.ERROR : LogLevel.INFO;
  }

  // Set the log level
  setLogLevel(level);
  logger.info(`Logging level set to ${LogLevel[level]}`);

  // Mark as configured
  loggingConfigured = true;
}

/**
 * Load application configuration from config.json
 */
// Track if we're currently loading config to prevent duplicate fetches
let isLoadingConfig = false;
let pendingConfigPromise: Promise<FrontendConfig> | null = null;

export async function loadConfig(): Promise<FrontendConfig> {
  // Return cached config if available
  if (_cfg !== undefined) {
    logger.debug('Config already loaded, using cached version');
    return _cfg;
  }

  // If we're already loading config, return the pending promise
  if (isLoadingConfig && pendingConfigPromise) {
    logger.debug('Config is already being loaded, reusing pending request');
    return pendingConfigPromise;
  }

  // Set loading flag and create promise
  isLoadingConfig = true;

  // Log only once at the start of fetching
  logger.info('Fetching config.json');

  pendingConfigPromise = (async () => {
    try {
      const res = await fetch('/config.json');
      logger.debug('Fetch response status:', res.status);

      if (!res.ok) {
        const text = await res.text();
        logger.debug('Fetch response text:', text);
        throw new Error(`Failed to load config.json: ${res.status} ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        logger.debug('Fetch response text:', text);
        throw new Error('config.json is not a JSON file');
      }

      const data = (await res.json()) as FrontendConfig;
      logger.debug('Loaded config:', data);
      _cfg = data;
      return data;
    } catch (error) {
      logger.error('Error loading config:', error);
      throw error;
    } finally {
      isLoadingConfig = false;
      pendingConfigPromise = null;
    }
  })();

  return pendingConfigPromise;
}
