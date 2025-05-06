// python_worker/src/log_utils.ts
import fs from 'fs';
import path from 'path';
import { format as formatDate } from 'date-fns';

// Niveaux de log
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  REQUEST = 'REQUEST',
  PERFORMANCE = 'PERFORMANCE'
}

// Configuration
const LOG_CONFIG = {
  // Niveau minimum à logger
  minLevel: (process.env.PYTHON_WORKER_LOG_LEVEL || 'INFO') as keyof typeof LogLevel,
  
  // Destination des logs
  logToConsole: true, // Log to console for development
  logToFile: true,    // Always log to file
  
  // Chemin du dossier de logs dans le container
  logDir: process.env.PYTHON_WORKER_LOG_DIR || '/app/logs',
  
  // Préfixe des fichiers de log
  filePrefix: process.env.PYTHON_WORKER_LOG_FILE_PREFIX || 'python_worker',
  
  // Fichier spécial pour les erreurs et warnings
  errorLogFile: 'all_errors_warnings.log',
  
  // Rotation des logs
  maxFileSize: parseInt(process.env.PYTHON_WORKER_LOG_MAX_FILE_SIZE || '10485760', 10), // 10 MB par défaut
};

// Structure d'un log
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  userId?: string;
  source: string;
  action: string;
  message: string;
  details?: any;
  correlationId?: string;
  requestId?: string;
  stack?: string;
  workerId?: string; // Added for Python worker to track which worker processed the task
}

// Cache des streams de fichiers
const fileStreams: Record<string, fs.WriteStream> = {};

// Formatage du log en JSON
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

// Obtenir le niveau numérique de log
function getLogLevelValue(level: LogLevel): number {
  const levels = {
    DEBUG: 0,
    INFO: 1,
    WARNING: 2,
    ERROR: 3,
    REQUEST: 1,
    PERFORMANCE: 1
  };
  return levels[level] || 0;
}

// Vérifier si un niveau de log doit être enregistré
function shouldLog(level: LogLevel): boolean {
  return getLogLevelValue(level) >= getLogLevelValue(LogLevel[LOG_CONFIG.minLevel]);
}

// Obtenir le stream de fichier pour un niveau de log
function getLogFileStream(level: LogLevel): fs.WriteStream | null {
  if (!LOG_CONFIG.logToFile) return null;

  const today = formatDate(new Date(), 'yyyy-MM-dd');
  const fileName = `${LOG_CONFIG.filePrefix}_${level.toLowerCase()}_${today}.log`;
  const filePath = path.join(LOG_CONFIG.logDir, fileName);
  
  // Vérifier si le stream existe déjà
  if (fileStreams[filePath]) return fileStreams[filePath];

  // Vérifier si le dossier existe, sinon le créer
  try {
    if (!fs.existsSync(LOG_CONFIG.logDir)) {
      fs.mkdirSync(LOG_CONFIG.logDir, { recursive: true });
    }
    
    // Créer le stream
    const stream = fs.createWriteStream(filePath, { flags: 'a' });
    fileStreams[filePath] = stream;
    
    return stream;
  } catch (error) {
    console.error(`Erreur lors de la création du dossier de logs ou du stream: ${(error as Error).message}`);
    return null;
  }
}

// Obtenir le stream pour le fichier spécial d'erreurs et warnings
function getErrorWarningStream(): fs.WriteStream | null {
  if (!LOG_CONFIG.logToFile) return null;

  const filePath = path.join(LOG_CONFIG.logDir, LOG_CONFIG.errorLogFile);
  
  // Vérifier si le stream existe déjà
  if (fileStreams[filePath]) return fileStreams[filePath];

  // Vérifier si le dossier existe, sinon le créer
  try {
    if (!fs.existsSync(LOG_CONFIG.logDir)) {
      fs.mkdirSync(LOG_CONFIG.logDir, { recursive: true });
    }
    
    // Créer le stream
    const stream = fs.createWriteStream(filePath, { flags: 'a' });
    fileStreams[filePath] = stream;
    
    return stream;
  } catch (error) {
    console.error(`Erreur lors de la création du stream pour erreurs et warnings: ${(error as Error).message}`);
    return null;
  }
}

// Rotation des logs si nécessaire
function checkLogRotation() {
  if (!LOG_CONFIG.logToFile) return;
  
  try {
    // Vérifier si le dossier existe
    if (!fs.existsSync(LOG_CONFIG.logDir)) {
      fs.mkdirSync(LOG_CONFIG.logDir, { recursive: true });
      return; // Dossier vide, pas besoin de rotation
    }
    
    // Liste tous les fichiers dans le dossier de logs
    const files = fs.readdirSync(LOG_CONFIG.logDir);
    
    for (const file of files) {
      try {
        const filePath = path.join(LOG_CONFIG.logDir, file);
        
        // Vérifier que c'est un fichier
        if (!fs.statSync(filePath).isFile()) continue;
        
        // Vérifier la taille du fichier
        const stats = fs.statSync(filePath);
        
        if (stats.size > LOG_CONFIG.maxFileSize) {
          // Fermer le stream si ouvert
          if (fileStreams[filePath]) {
            fileStreams[filePath].close();
            delete fileStreams[filePath];
          }
          
          // Renommer le fichier avec un timestamp
          const timestamp = formatDate(new Date(), 'yyyyMMddHHmmss');
          const [name, ext] = file.split('.');
          const newPath = path.join(LOG_CONFIG.logDir, `${name}_${timestamp}.${ext}`);
          
          fs.renameSync(filePath, newPath);
          console.log(`📄 [Log] Rotated log file: ${file} -> ${path.basename(newPath)}`);
        }
      } catch (fileError) {
        console.error(`❌ [Log] Error processing file during rotation: ${file}`, (fileError as Error).message);
      }
    }
  } catch (error) {
    console.error(`❌ [Log] Error during log rotation:`, (error as Error).message);
  }
}

// Écrire un log
function writeLog(entry: LogEntry) {
  // Log to console if enabled
  if (LOG_CONFIG.logToConsole) {
    const consoleMethod = entry.level === LogLevel.ERROR || entry.level === LogLevel.WARNING 
      ? console.error 
      : (entry.level === LogLevel.DEBUG ? console.debug : console.log);
    
    consoleMethod(`[${entry.level}] ${entry.source}:${entry.action} - ${entry.message}`);
  }
  
  // Log to file if enabled
  if (LOG_CONFIG.logToFile) {
    const stream = getLogFileStream(entry.level);
    
    if (stream) {
      stream.write(formatLogEntry(entry) + '\n');
    }
    
    // Also log errors and warnings to special file
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.WARNING) {
      const errorStream = getErrorWarningStream();
      
      if (errorStream) {
        errorStream.write(formatLogEntry(entry) + '\n');
      }
    }
  }
}

// Vérifier la rotation des logs périodiquement
try {
  setInterval(checkLogRotation, 60 * 60 * 1000); // Toutes les heures
  // Vérifier au démarrage avec une gestion des erreurs
  setTimeout(checkLogRotation, 1000);
} catch (error) {
  console.error('Error setting up log rotation:', (error as Error).message);
}

// Fonctions publiques
export function logInfo(
  source: string, 
  action: string, 
  message: string, 
  userId?: string, 
  details?: any, 
  correlationId?: string, 
  requestId?: string,
  workerId?: string
) {
  if (!shouldLog(LogLevel.INFO)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    userId,
    source,
    action,
    message,
    details,
    correlationId,
    requestId,
    workerId
  };
  
  writeLog(entry);
}

export function logError(
  source: string, 
  action: string, 
  error: Error | string,
  userId?: string, 
  details?: any, 
  correlationId?: string, 
  requestId?: string,
  workerId?: string
) {
  if (!shouldLog(LogLevel.ERROR)) return;
  
  const message = error instanceof Error ? error.message : error;
  const stack = error instanceof Error ? error.stack : undefined;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.ERROR,
    userId,
    source,
    action,
    message,
    details,
    correlationId,
    requestId,
    stack,
    workerId
  };
  
  writeLog(entry);
}

export function logWarning(
  source: string, 
  action: string, 
  message: string, 
  userId?: string, 
  details?: any, 
  correlationId?: string, 
  requestId?: string,
  workerId?: string
) {
  if (!shouldLog(LogLevel.WARNING)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.WARNING,
    userId,
    source,
    action,
    message,
    details,
    correlationId,
    requestId,
    workerId
  };
  
  writeLog(entry);
}

export function logDebug(
  source: string, 
  action: string, 
  message: string, 
  userId?: string, 
  details?: any, 
  correlationId?: string, 
  requestId?: string,
  workerId?: string
) {
  if (!shouldLog(LogLevel.DEBUG)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.DEBUG,
    userId,
    source,
    action,
    message,
    details,
    correlationId,
    requestId,
    workerId
  };
  
  writeLog(entry);
}

export function logRequest(
  source: string, 
  action: string, 
  userId: string, 
  requestDetails: any, 
  requestId?: string, 
  correlationId?: string,
  workerId?: string
) {
  if (!shouldLog(LogLevel.REQUEST)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.REQUEST,
    userId,
    source,
    action,
    message: 'Request details',
    details: requestDetails,
    correlationId,
    requestId,
    workerId
  };
  
  writeLog(entry);
}

export function logPerformance(
  source: string, 
  action: string, 
  durationMs: number, 
  userId?: string, 
  details?: any, 
  correlationId?: string, 
  requestId?: string,
  workerId?: string
) {
  if (!shouldLog(LogLevel.PERFORMANCE)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.PERFORMANCE,
    userId,
    source,
    action,
    message: `Duration: ${durationMs}ms`,
    details,
    correlationId,
    requestId,
    workerId
  };
  
  writeLog(entry);
}

// Utilitaire pour mesurer les performances
export function startPerformanceTimer(
  source: string, 
  action: string, 
  userId?: string, 
  details?: any, 
  correlationId?: string, 
  requestId?: string,
  workerId?: string
): () => void {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    logPerformance(source, action, durationMs, userId, details, correlationId, requestId, workerId);
  };
}

// Clean up function to close all streams
export function cleanup() {
  for (const filePath in fileStreams) {
    if (fileStreams[filePath]) {
      try {
        fileStreams[filePath].close();
      } catch (error) {
        console.error(`Error closing stream for ${filePath}:`, (error as Error).message);
      }
    }
  }
}

// Exporter une instance unique du logger pour éviter de multiples fichiers
const logger = {
  logInfo,
  logError,
  logWarning,
  logDebug,
  logRequest,
  logPerformance,
  startPerformanceTimer,
  cleanup
};

export default logger;