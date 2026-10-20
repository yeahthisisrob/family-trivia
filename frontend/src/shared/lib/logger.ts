/**
 * Logger Utility
 *
 * Provides consistent, configurable logging across the application.
 * This allows for a unified approach to logging that can be easily
 * enabled/disabled based on environment or specific modules.
 */

// Configurable log levels
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

// Map to track log messages that have already been shown
// This helps prevent duplicate logs, especially during development with React StrictMode
const logCache = new Map<string, number>();

// Current log level - can be adjusted based on environment
// In production, this would typically be set to ERROR or WARN
let currentLogLevel = import.meta.env.PROD ? LogLevel.ERROR : LogLevel.INFO;

// Set log level manually if needed
export const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
};

// Helper to determine if a message has been logged recently
// Returns true if message should be suppressed (already logged recently)
const isDuplicateLog = (module: string, level: LogLevel, message: string): boolean => {
  // Skip duplicate detection in production for performance
  if (import.meta.env.PROD) return false;

  const key = `${module}:${level}:${message}`;
  const now = Date.now();
  const lastLogTime = logCache.get(key) || 0;

  // Prevent logging the same message more than once per 500ms
  // This helps with React StrictMode double-rendering and other duplicate calls
  // Increased from 200ms to 500ms to better handle application initialization
  if (now - lastLogTime < 500) {
    return true;
  }

  // Update the cache with current timestamp
  logCache.set(key, now);

  // Clean up old entries periodically (every 100 entries)
  if (logCache.size > 100) {
    const expirationTime = now - 10000; // 10 seconds (increased from 5)

    // Use forEach instead of for...of to avoid compatibility issues with older JS targets
    logCache.forEach((timestamp, cacheKey) => {
      if (timestamp < expirationTime) {
        logCache.delete(cacheKey);
      }
    });
  }

  return false;
};

// Module name prefixing for better log organization
const formatMessage = (module: string, message: string): string => {
  return `[${module}] ${message}`;
};

/**
 * Logger interface with module-specific prefixing
 */
export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Create a logger for a specific module
 *
 * @param module Name of the module (component, service, etc.)
 * @returns Logger instance with module context
 */
export const createLogger = (module: string): Logger => {
  return {
    debug: (message: string, ...args: unknown[]) => {
      if (currentLogLevel >= LogLevel.DEBUG && !isDuplicateLog(module, LogLevel.DEBUG, message)) {
        console.debug(formatMessage(module, message), ...args);
      }
    },

    info: (message: string, ...args: unknown[]) => {
      if (currentLogLevel >= LogLevel.INFO && !isDuplicateLog(module, LogLevel.INFO, message)) {
        console.info(formatMessage(module, message), ...args);
      }
    },

    warn: (message: string, ...args: unknown[]) => {
      if (currentLogLevel >= LogLevel.WARN && !isDuplicateLog(module, LogLevel.WARN, message)) {
        console.warn(formatMessage(module, message), ...args);
      }
    },

    error: (message: string, ...args: unknown[]) => {
      if (currentLogLevel >= LogLevel.ERROR && !isDuplicateLog(module, LogLevel.ERROR, message)) {
        console.error(formatMessage(module, message), ...args);
      }
    },
  };
};

// Default logger for quick usage
export const logger = createLogger('App');
