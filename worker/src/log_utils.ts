import fs from 'fs';
import path from 'path';
import { format as formatDate } from 'date-fns';

// Log levels for workers
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  PERFORMANCE = 'PERFORMANCE',
  PROCESSING = 'PROCESSING'  // New level for job processing events
}

// Configuration for worker logs
const LOG_CONFIG = {
  // Minimum log level
  minLevel: (process.env.LOG_LEVEL || 'INFO') as keyof typeof LogLevel,
  
  // Log destinations
  logToConsole: process.env.NODE_ENV === 'development',
  logToFile: true,
  
  // Log directory in container
  logDir: process.env.LOG_DIR || '/app/logs',
  
  // Log file prefixes
  filePrefix: 'worker',
  
  // Log rotation
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760', 10), // 10 MB default
  
  // Worker specific
  workerSpecificLogs: true,
};

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  workerId: string;
  jobId?: string;
  source: string;
  action: string;
  message: string;
  details?: any;
  performance?: {
    duration?: number;
    itemsProcessed?: number;
    batchSize?: number;
    successRate?: number;
  };
  error?: {
    name?: string;
    code?: string;
    stack?: string;
  };
}

// Simplified context used by the unified logEvent API
export interface LogContext {
  userId: string;
  workerId: string;
  dataType?: 'followers' | 'targets';
  chunkIndex?: number;
  jobId?: string;
  correlationId?: string;
}

// Cache for file streams
const fileStreams: Record<string, fs.WriteStream> = {};

// Format log entry as JSON
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry) + '\n';
}

// Get numeric log level
function getLogLevelValue(level: LogLevel): number {
  const levels = {
    DEBUG: 0,
    INFO: 1,
    PROCESSING: 2,
    PERFORMANCE: 3,
    WARNING: 4,
    ERROR: 5
  };
  return levels[level] || 0;
}

// Get appropriate log file path based on level and date
function getLogFilePath(level: LogLevel, workerId: string): string {
  const date = formatDate(new Date(), 'yyyy-MM-dd');
  const baseDir = LOG_CONFIG.logDir;

  // Ensure log directory exists
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // Create a file per day per log type
  switch(level) {
    case LogLevel.ERROR:
      return path.join(baseDir, `worker_error_${date}.log`);
    case LogLevel.WARNING:
      return path.join(baseDir, `worker_warning_${date}.log`);
    case LogLevel.PERFORMANCE:
      return path.join(baseDir, `worker_performance_${date}.log`);
    case LogLevel.PROCESSING:
      return path.join(baseDir, `worker_processing_${date}.log`);
    default:
      // For DEBUG and INFO, use a general log file per day
      if (LOG_CONFIG.workerSpecificLogs) {
        return path.join(baseDir, `worker_general_${workerId}_${date}.log`);
      }
      return path.join(baseDir, `worker_general_${date}.log`);
  }
}

// Get or create file stream
function getFileStream(filePath: string): fs.WriteStream {
  if (!fileStreams[filePath]) {
    fileStreams[filePath] = fs.createWriteStream(filePath, { flags: 'a' });
  }
  return fileStreams[filePath];
}

// Check if log rotation is needed
function checkLogRotation(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.size > LOG_CONFIG.maxFileSize) {
        // Close existing stream
        if (fileStreams[filePath]) {
          fileStreams[filePath].end();
          delete fileStreams[filePath];
        }
        
        // Create backup file with timestamp
        const timestamp = formatDate(new Date(), 'yyyyMMdd_HHmmss');
        const backupPath = `${filePath}.${timestamp}`;
        fs.renameSync(filePath, backupPath);
      }
    }
  } catch (err) {
    console.error(`Error checking log rotation: ${err}`);
  }
}

// Main logging function
function log(
  level: LogLevel,
  source: string,
  action: string,
  message: string,
  workerId: string,
  details?: any,
  error?: Error,
  performance?: LogEntry['performance']
) {
  // Check minimum log level
  if (getLogLevelValue(level) < getLogLevelValue(LOG_CONFIG.minLevel as LogLevel)) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    workerId,
    source,
    action,
    message,
    details
  };

  // Add performance metrics if provided
  if (performance) {
    entry.performance = performance;
  }

  // Add error information if provided
  if (error) {
    entry.error = {
      name: error.name,
      stack: error.stack,
      code: (error as any).code
    };
  }

  // Console logging in development
  if (LOG_CONFIG.logToConsole) {
    console.log(formatLogEntry(entry));
  }

  // File logging
  if (LOG_CONFIG.logToFile) {
    const filePath = getLogFilePath(level, workerId);
    
    // Check if log rotation is needed
    checkLogRotation(filePath);
    
    // Write to log file
    const stream = getFileStream(filePath);
    stream.write(formatLogEntry(entry));
  }
}

// Unified event logger to simplify worker logging
export function logEvent(
  event: string,
  context: LogContext,
  payload?: Record<string, any>,
  level: LogLevel = LogLevel.INFO
) {
  const { userId, workerId, ...rest } = context;
  // Use existing log() with standardized fields
  const details = { userId, event, ...rest, ...(payload || {}) };
  // source=worker, action=event, message=event for simplicity
  log(level, 'worker', event, event, workerId, details);
}

// Convenience logging methods
export default {
  logDebug: (source: string, action: string, message: string, workerId: string, details?: any) =>
    log(LogLevel.DEBUG, source, action, message, workerId, details),
    
  logInfo: (source: string, action: string, message: string, workerId: string, details?: any) =>
    log(LogLevel.INFO, source, action, message, workerId, details),
    
  logWarning: (source: string, action: string, message: string, workerId: string, details?: any, error?: Error) =>
    log(LogLevel.WARNING, source, action, message, workerId, details, error),
    
  logError: (source: string, action: string, message: string, workerId: string, details?: any, error?: Error) =>
    log(LogLevel.ERROR, source, action, message, workerId, details, error),
    
  logPerformance: (source: string, action: string, message: string, workerId: string, performance: LogEntry['performance'], details?: any) =>
    log(LogLevel.PERFORMANCE, source, action, message, workerId, details, undefined, performance),
    
  logProcessing: (source: string, action: string, message: string, workerId: string, details?: any, performance?: LogEntry['performance']) =>
    log(LogLevel.PROCESSING, source, action, message, workerId, details, undefined, performance)
};