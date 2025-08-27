// worker/src/index.ts
import * as dotenv from 'dotenv';
import { JobManager } from './jobManager';
import { processJob } from './jobProcessor';
import { redisClient } from './redisClient';
import logger from './log_utils';
import { authClient } from './supabase'

// Charger les variables d'environnement au tout début
dotenv.config();

// Configuration du worker
interface WorkerConfig {
  id: string;
  pollingInterval: number; // Maintenant utilisé comme timeout pour Redis BRPOP
  stalledJobTimeout: number;
  circuitBreakerResetTimeout: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  id: 'worker1',
  pollingInterval: 30000,     // 30 secondes timeout pour BRPOP
  stalledJobTimeout: 60000,   // 1 minute
  circuitBreakerResetTimeout: 15000,  // 15 secondes
  retryDelay: 15000,          // 15 secondes
};

// Récupérer la configuration depuis les variables d'environnement
const WORKER_CONFIG: WorkerConfig = {
  id: process.env.WORKER_ID || DEFAULT_CONFIG.id,
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || '') || DEFAULT_CONFIG.pollingInterval,
  stalledJobTimeout: parseInt(process.env.STALLED_JOB_TIMEOUT || '') || DEFAULT_CONFIG.stalledJobTimeout,
  circuitBreakerResetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '') || DEFAULT_CONFIG.circuitBreakerResetTimeout,
  retryDelay: parseInt(process.env.RETRY_DELAY || '') || DEFAULT_CONFIG.retryDelay,
};

// Performance tracking interfaces
interface WorkerMetrics {
  startTime: number;
  totalJobsProcessed: number;
  successfulJobs: number;
  failedJobs: number;
  stalledJobsRecovered: number;
  queueMetrics: QueueMetrics;
  errors: ErrorMetrics;
}

interface QueueMetrics {
  currentQueueLength: number;
  peakQueueLength: number;
  totalJobsQueued: number;
  averageWaitTime: number;
  lastProcessingTime: number;
}

interface ErrorMetrics {
  redisErrors: number;
  processingErrors: number;
  stalledJobErrors: number;
  circuitBreakerTrips: number;
  lastError?: {
    timestamp: number;
    type: string;
    message: string;
  };
}

// Initialize worker metrics
const workerMetrics: WorkerMetrics = {
  startTime: Date.now(),
  totalJobsProcessed: 0,
  successfulJobs: 0,
  failedJobs: 0,
  stalledJobsRecovered: 0,
  queueMetrics: {
    currentQueueLength: 0,
    peakQueueLength: 0,
    totalJobsQueued: 0,
    averageWaitTime: 0,
    lastProcessingTime: 0
  },
  errors: {
    redisErrors: 0,
    processingErrors: 0,
    stalledJobErrors: 0,
    circuitBreakerTrips: 0
  }
};

// Types d'erreurs spécifiques
class WorkerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'WorkerError';
  }
}

class RedisError extends WorkerError {
  constructor(message: string, public readonly originalError: any) {
    super(message, 'REDIS_ERROR');
    this.name = 'RedisError';
  }
}

class CircuitBreakerError extends WorkerError {
  constructor(message: string = 'Circuit breaker is open') {
    super(message, 'CIRCUIT_BREAKER_ERROR');
    this.name = 'CircuitBreakerError';
  }
}

class JobProcessingError extends WorkerError {
  constructor(message: string, public readonly jobId: string) {
    super(message, 'JOB_PROCESSING_ERROR');
    this.name = 'JobProcessingError';
  }
}

// Circuit breaker pour Redis
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private maxFailures = 5,
    private resetTimeout = WORKER_CONFIG.circuitBreakerResetTimeout
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        console.log('CircuitBreaker', 'execute', 'Circuit breaker transitioning to HALF_OPEN');
      } else {
        throw new CircuitBreakerError();
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.maxFailures) {
      this.state = 'OPEN';
      workerMetrics.errors.circuitBreakerTrips++;
      console.log('CircuitBreaker', 'onFailure', 'Circuit breaker opened due to failures', {
        failures: this.failures,
        maxFailures: this.maxFailures
      });
    }
  }

  getState(): string {
    return this.state;
  }
}

// Instance globale du circuit breaker
const circuitBreaker = new CircuitBreaker();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction utilitaire pour attendre un temps aléatoire
function randomSleep(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

// Fonction utilitaire pour retry avec backoff exponentiel
async function updateUserOnboardedStatusWithRetry(
  authClient: any,
  userId: string,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<{ success: boolean; error?: string }> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await authClient
        .from('users')
        .update({ has_onboarded: true })
        .eq('id', userId);

      if (!error) {
        return { success: true };
      }

      // Si c'est un timeout et qu'on a encore des tentatives
      if (error.message.includes('timeout') && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Backoff exponentiel
        console.log(`Worker updateUserOnboardedStatus ⏳ Attempt ${attempt}/${maxRetries} failed (timeout), retrying in ${delay}ms...`, {
          userId,
          error: error.message
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // Autre erreur ou dernière tentative
      return { success: false, error: error.message };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Si c'est un timeout et qu'on a encore des tentatives
      if (errorMessage.includes('timeout') && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`Worker updateUserOnboardedStatus ⏳ Attempt ${attempt}/${maxRetries} failed (exception), retrying in ${delay}ms...`, {
          userId,
          error: errorMessage
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return { success: false, error: errorMessage };
    }
  }

  return { success: false, error: 'Max retries exceeded' };
}

async function startWorker(): Promise<void> {
  const workerId = WORKER_CONFIG.id;
  let jobManager: JobManager | null = null;
  let isShuttingDown = false;

  console.log('Worker', 'startWorker', `🚀 Starting Redis-powered worker`, {
    workerId,
    config: WORKER_CONFIG
  });

  try {
    // Initialiser le gestionnaire de jobs
    jobManager = new JobManager({
      syncInterval: 60000, // 1 minute
      batchSize: 10,
      maxRetries: 3
    });

    await jobManager.start();

    console.log('Worker', 'startWorker', `✅ Worker ${workerId} started successfully with Redis queue`);

    // Boucle principale du worker
    while (!isShuttingDown) {
      try {
        // Utiliser le circuit breaker pour les opérations Redis
        const job = await circuitBreaker.execute(async () => {
          return await jobManager!.getNextJob(workerId);
        });

        if (!job) {
          // Pas de job disponible, continuer la boucle
          // BRPOP a déjà attendu le timeout configuré
          continue;
        }

        console.log('Worker', 'processJob', `📋 Processing job ${job.id}`, {
          workerId,
          jobId: job.id,
          userId: job.user_id,
          jobType: job.job_type
        });

        // Stocker le job en processing dans Redis pour l'API
        const processingJobData = {
          id: job.id,
          user_id: job.user_id,
          status: 'processing',
          total_items: job.total_items,
          stats: job.stats || {},
          error_log: null,
          updated_at: new Date().toISOString()
        };
        
        await redisClient.getClient().set(`job:${job.id}`, JSON.stringify(processingJobData), 'EX', 3600);

        // Traitement du job
        const startTime = Date.now();
        
        try {
          const jobStats = await processJob(job, workerId);
          
          const processingTime = Date.now() - startTime;
          workerMetrics.queueMetrics.lastProcessingTime = processingTime;
          
          // Marquer le job comme terminé avec les vraies statistiques
          await jobManager.completeJob(job.id, workerId, jobStats);
          
          workerMetrics.successfulJobs++;
          workerMetrics.totalJobsProcessed++;

          console.log('Worker', 'processJob', `✅ Job ${job.id} completed successfully`, {
            workerId,
            jobId: job.id,
            processingTime: `${processingTime}ms`,
            stats: jobStats
          });

          const { success, error } = await updateUserOnboardedStatusWithRetry(authClient, job.user_id);
          if (!success) {
            console.log('Worker', 'processJob', `❌ Failed to update user ${job.user_id} onboarded status`, {
              workerId,
              jobId: job.id,
              error
            });
          }

        } catch (processingError) {
          const errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error';
          
          // Marquer le job comme échoué
          await jobManager.failJob(job.id, workerId, errorMessage);
          
          workerMetrics.failedJobs++;
          workerMetrics.totalJobsProcessed++;
          workerMetrics.errors.processingErrors++;
          workerMetrics.errors.lastError = {
            timestamp: Date.now(),
            type: 'PROCESSING_ERROR',
            message: errorMessage
          };

          console.log('Worker', 'processJob', `❌ Job ${job.id} failed`, {
            workerId,
            jobId: job.id,
            error: errorMessage,
            processingTime: `${Date.now() - startTime}ms`
          });
        }

        // Mettre à jour les métriques de queue
        const queueMetrics = await jobManager.getMetrics();
        workerMetrics.queueMetrics.currentQueueLength = queueMetrics.pendingJobs;
        if (queueMetrics.pendingJobs > workerMetrics.queueMetrics.peakQueueLength) {
          workerMetrics.queueMetrics.peakQueueLength = queueMetrics.pendingJobs;
        }

      } catch (error) {
        if (error instanceof CircuitBreakerError) {
          console.log('Worker', 'startWorker', 'Circuit breaker is open, waiting before retry', {
            workerId,
            retryDelay: WORKER_CONFIG.retryDelay
          });
          await sleep(WORKER_CONFIG.retryDelay);
          continue;
        }

        if (error instanceof RedisError) {
          workerMetrics.errors.redisErrors++;
        }

        workerMetrics.errors.lastError = {
          timestamp: Date.now(),
          type: error instanceof WorkerError ? error.code : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        };

        console.log('Worker', 'startWorker', 'Error in worker main loop', {
          workerId,
          error: error instanceof Error ? error.message : 'Unknown error',
          circuitBreakerState: circuitBreaker.getState()
        });

        // Attendre avant de réessayer
        await randomSleep(1000, 5000);
      }
    }

  } catch (error) {
    console.log('Worker', 'startWorker', `💥 Fatal error in worker ${workerId}`, {
      workerId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    throw error;
  } finally {
    // Nettoyage
    if (jobManager) {
      try {
        await jobManager.stop();
        console.log('Worker', 'startWorker', `👋 Worker ${workerId} stopped gracefully`);
      } catch (cleanupError) {
        console.log('Worker', 'startWorker', 'Error during cleanup', {
          workerId,
          error: cleanupError instanceof Error ? cleanupError.message : 'Unknown cleanup error'
        });
      }
    }
  }

  // Gestion des signaux d'arrêt
  const gracefulShutdown = async (signal: string) => {
    console.log('Worker', 'gracefulShutdown', `📡 Received ${signal}, shutting down gracefully...`, {
      workerId
    });
    
    isShuttingDown = true;
    
    // Afficher les métriques finales
    const uptime = Date.now() - workerMetrics.startTime;
    console.log('Worker', 'gracefulShutdown', `📊 Final worker metrics`, {
      workerId,
      uptime: `${Math.round(uptime / 1000)}s`,
      totalJobsProcessed: workerMetrics.totalJobsProcessed,
      successfulJobs: workerMetrics.successfulJobs,
      failedJobs: workerMetrics.failedJobs,
      successRate: workerMetrics.totalJobsProcessed > 0 
        ? `${Math.round((workerMetrics.successfulJobs / workerMetrics.totalJobsProcessed) * 100)}%` 
        : '0%',
      errors: workerMetrics.errors
    });
    
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// Point d'entrée principal
if (require.main === module) {
  startWorker().catch((error) => {
    console.log('Worker', 'main', '💀 Worker crashed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  });
}