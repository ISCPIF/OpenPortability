import fs from 'fs';
import path from 'path';
import { format as formatDate } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/auth';

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
  minLevel: (process.env.LOG_LEVEL || 'INFO') as keyof typeof LogLevel,
  
  // Destination des logs
  logToConsole: false, // Force console logging to false
  logToFile: true, // Always log to file
  
  // Chemin du dossier de logs dans le container
  logDir: process.env.LOG_DIR || '/app/logs',
  
  // Préfixe des fichiers de log
  filePrefix: process.env.LOG_FILE_PREFIX || 'app',
  
  // Fichier spécial pour les erreurs et warnings
  errorLogFile: 'all_errors_warnings.log',
  
  // Rotation des logs
  maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760', 10), // 10 MB par défaut
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
    console.error(`Erreur lors de la création du dossier de logs ou du stream: ${error.message}`);
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
    console.error(`Erreur lors de la création du stream pour erreurs et warnings: ${error.message}`);
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
    const files = fs.readdirSync(LOG_CONFIG.logDir)
      .filter(file => file.startsWith(LOG_CONFIG.filePrefix))
      .map(file => ({
        name: file,
        path: path.join(LOG_CONFIG.logDir, file),
        size: fs.statSync(path.join(LOG_CONFIG.logDir, file)).size,
        mtime: fs.statSync(path.join(LOG_CONFIG.logDir, file)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Plus récent d'abord
    
    // Vérifier la taille de chaque fichier
    for (const file of files) {
      if (file.size > LOG_CONFIG.maxFileSize) {
        // Fermer le stream si existant
        if (fileStreams[file.path]) {
          fileStreams[file.path].end();
          delete fileStreams[file.path];
        }
        
        // Archiver le fichier
        const archivePath = `${file.path}.${formatDate(new Date(), 'yyyyMMdd_HHmmss')}.archived`;
        fs.renameSync(file.path, archivePath);
      }
    }
    
    // Ne supprime plus les fichiers excédentaires
    // La suppression des anciens fichiers est désactivée car ils sont stockés dans un volume Docker
  } catch (error) {
    console.error('Error during log rotation:', error);
  }
}

// Écrire un log
function writeLog(entry: LogEntry) {
  // Formater le log
  const formattedLog = formatLogEntry(entry);
  
  // Écrire dans un fichier uniquement
  if (LOG_CONFIG.logToFile) {
    const stream = getLogFileStream(entry.level);
    if (stream) {
      stream.write(formattedLog + '\n');
    }
    
    // Écrire également dans le fichier spécial pour les erreurs et warnings
    if (entry.level === LogLevel.ERROR || entry.level === LogLevel.WARNING) {
      const errorStream = getErrorWarningStream();
      if (errorStream) {
        errorStream.write(formattedLog + '\n');
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
  console.error('Error setting up log rotation:', error);
}

// Fonctions publiques
export function logInfo(source: string, action: string, message: string, userId?: string, details?: any, correlationId?: string, requestId?: string) {
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
    requestId
  };
  
  writeLog(entry);
}

export function logError(source: string, action: string, error: Error | string, userId?: string, details?: any, correlationId?: string, requestId?: string) {
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
    stack
  };
  
  writeLog(entry);
}

export function logWarning(source: string, action: string, message: string, userId?: string, details?: any, correlationId?: string, requestId?: string) {
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
    requestId
  };
  
  writeLog(entry);
}

export function logDebug(source: string, action: string, message: string, userId?: string, details?: any, correlationId?: string, requestId?: string) {
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
    requestId
  };
  
  writeLog(entry);
}

export function logRequest(source: string, action: string, userId: string, requestDetails: any, requestId?: string, correlationId?: string) {
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
    requestId
  };
  
  writeLog(entry);
}

export function logPerformance(source: string, action: string, durationMs: number, userId?: string, details?: any, correlationId?: string, requestId?: string) {
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
    requestId
  };
  
  writeLog(entry);
}

// Utilitaire pour mesurer les performances
export function startPerformanceTimer(source: string, action: string, userId?: string, details?: any, correlationId?: string, requestId?: string): () => void {
  const startTime = performance.now();
  
  return () => {
    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);
    logPerformance(source, action, durationMs, userId, details, correlationId, requestId);
  };
}

// Middleware pour les API routes de Next.js App Router
export function withLogging(handler: Function) {
  return async function(req: NextRequest) {
    const requestId = req.headers.get('x-request-id') || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Extraire l'ID utilisateur si disponible
    const session = await auth(); // Dans l'App Router, nous n'avons pas accès à la session directement ici
    const userId = session?.user?.id || 'anonymous';
    
    // Enregistrer la requête
    logRequest('API', req.nextUrl.pathname, userId, {
      method: req.method,
      url: req.url,
      headers: Object.fromEntries(req.headers.entries())
    }, requestId);
    
    // Mesurer les performances
    const endTimer = startPerformanceTimer('API', req.nextUrl.pathname, userId, undefined, undefined, requestId);
    
    try {
      // Appeler le handler d'origine
      const response = await handler(req);
      
      // Terminer la mesure du temps
      endTimer();
      
      // Cloner la réponse pour pouvoir la modifier
      const finalResponse = NextResponse.json(
        response.body ? await response.json() : {},
        { status: response.status, headers: response.headers }
      );
      
      // Ajouter l'ID de requête aux headers de réponse
      finalResponse.headers.set('X-Request-ID', requestId);
      
      // Enregistrer les informations de réponse
      logInfo('API', `${req.nextUrl.pathname} Response`, `Status: ${response.status}`, userId, {
        statusCode: response.status
      }, undefined, requestId);
      
      return finalResponse;
    } catch (error) {
      // Terminer la mesure du temps
      endTimer();
      
      // Enregistrer l'erreur
      logError('API', req.nextUrl.pathname, error, userId, {
        method: req.method,
        url: req.url
      }, undefined, requestId);
      
      // Renvoyer une réponse d'erreur
      const errorResponse = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 }
      );
      
      // Ajouter les headers de corrélation
      errorResponse.headers.set('x-request-id', requestId);
      errorResponse.headers.set('x-correlation-id', correlationId);
      
      return errorResponse;
    }
  };
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
  withLogging
};

export default logger;