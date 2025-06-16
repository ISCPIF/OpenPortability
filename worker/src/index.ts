// worker/src/index.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { processJob } from './jobProcessor';

// Charger les variables d'environnement au tout début
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configuration du worker
interface WorkerConfig {
  id: string;
  pollingInterval: number;
  stalledJobTimeout: number;
  circuitBreakerResetTimeout: number;
  retryDelay: number;
}

const DEFAULT_CONFIG: WorkerConfig = {
  id: 'worker1',
  pollingInterval: 15000,     // 1 seconde
  stalledJobTimeout: 60000,  // 1 minute
  circuitBreakerResetTimeout: 15000,  // 5 secondes
  retryDelay: 15000,         // 1 seconde
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
  supabaseErrors: number;
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
    lastProcessingTime: 0,
  },
  errors: {
    supabaseErrors: 0,
    processingErrors: 0,
    stalledJobErrors: 0,
    circuitBreakerTrips: 0,
  }
};

// Types d'erreurs spécifiques
class WorkerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'WorkerError';
  }
}

class SupabaseError extends WorkerError {
  constructor(message: string, public readonly originalError: any) {
    super(message, 'SUPABASE_ERROR');
    this.name = 'SupabaseError';
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

class StalledJobError extends WorkerError {
  constructor(message: string, public readonly jobId: string) {
    super(message, 'STALLED_JOB_ERROR');
    this.name = 'StalledJobError';
  }
}

async function recoverStalledJobs() {
  const startTime = Date.now();
  
  try {
    // Récupérer les jobs bloqués depuis plus de X minutes
    const stalledTimeout = new Date(Date.now() - WORKER_CONFIG.stalledJobTimeout);
    
    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('status', 'processing')
      .lt('updated_at', stalledTimeout.toISOString())
      .order('created_at')
      .limit(1);

    if (error) {
      workerMetrics.errors.supabaseErrors++;
      throw new SupabaseError('Failed to fetch stalled jobs', error);
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log(`✨ [Worker ${WORKER_CONFIG.id}] Recovering stalled job: ${job.id}`);
      await processJob(job, WORKER_CONFIG.id);
      workerMetrics.stalledJobsRecovered++;
    }
  } catch (error) {
    workerMetrics.errors.stalledJobErrors++;
    workerMetrics.errors.lastError = {
      timestamp: Date.now(),
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    
    console.error(`❌ [Worker ${WORKER_CONFIG.id}] Error recovering stalled jobs:`, error);
    
    await sleep(WORKER_CONFIG.retryDelay);
  } finally {
    const duration = Date.now() - startTime;
    // console.log(`📊 [Worker ${WORKER_CONFIG.id}] Stalled jobs check completed in ${duration}ms`);
  }
}

async function checkForPendingJobs() {
  const startTime = Date.now();
  
  try {
    // Utiliser la fonction claim_next_pending_job pour récupérer et verrouiller le prochain job
    const { data: jobs, error } = await supabase
      .rpc('claim_next_pending_job', { worker_id_input: WORKER_CONFIG.id });
    if (!error && jobs) {
        workerMetrics.queueMetrics.currentQueueLength = jobs.length;
        workerMetrics.queueMetrics.peakQueueLength = Math.max(
          workerMetrics.queueMetrics.peakQueueLength,
          jobs.length
        );
      }

    if (error) {
      workerMetrics.errors.supabaseErrors++;
      throw new SupabaseError('Failed to claim next job', error);
    }

    if (!jobs || jobs.length === 0) {
      return;
    }

    const job = jobs[0];
    workerMetrics.queueMetrics.totalJobsQueued++;
    
    const waitTime = Date.now() - new Date(job.created_at).getTime();
    workerMetrics.queueMetrics.averageWaitTime = 
      (workerMetrics.queueMetrics.averageWaitTime * (workerMetrics.totalJobsProcessed) + waitTime) / 
      (workerMetrics.totalJobsProcessed + 1);

    const jobStartTime = Date.now();
    try {
      await processJob(job, WORKER_CONFIG.id);
      workerMetrics.successfulJobs++;
    } catch (error) {
      workerMetrics.failedJobs++;
      throw error;
    } finally {
      workerMetrics.totalJobsProcessed++;
      workerMetrics.queueMetrics.lastProcessingTime = Date.now() - jobStartTime;
    }
  } catch (error) {
    workerMetrics.errors.processingErrors++;
    workerMetrics.errors.lastError = {
      timestamp: Date.now(),
      type: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
    
    console.error(`❌ [Worker ${WORKER_CONFIG.id}] Error checking for pending jobs:`, error);
    
    await sleep(WORKER_CONFIG.retryDelay);
  } finally {
    const duration = Date.now() - startTime;
    // console.log(`📊 [Worker ${WORKER_CONFIG.id}] Pending jobs check completed in ${duration}ms`);
  }
}

async function safeSupabaseCall<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof CircuitBreakerError) {
      throw error;
    } else if (error instanceof SupabaseError) {
      console.error(`❌ [Worker ${WORKER_CONFIG.id}] Supabase error:`, error.message, error.originalError);
      throw error;
    } else {
      console.error(`💥 [Worker ${WORKER_CONFIG.id}] Unexpected error:`, error);
      throw new WorkerError('Unexpected error during Supabase operation', 'UNKNOWN_ERROR');
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction utilitaire pour attendre un temps aléatoire
function randomSleep(min: number, max: number) {
  const delay = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function startWorker() {
  const startupDelay = Math.floor(Math.random() * 4000) + 1000;
  console.log(`🚀 [Worker ${WORKER_CONFIG.id}] Starting with delay of ${startupDelay}ms...`);
  await sleep(startupDelay);

  console.log(`🚀 [Worker ${WORKER_CONFIG.id}] Starting import worker...`);
  console.log(`📋 [Worker ${WORKER_CONFIG.id}] Configuration:`, WORKER_CONFIG);
  
  // Reset metrics on worker start
  workerMetrics.startTime = Date.now();
  
  const stalledJobsInterval = setInterval(async () => {
    try {
      await recoverStalledJobs();
    } catch (error) {
      console.error(`❌ [Worker ${WORKER_CONFIG.id}] Error checking stalled jobs:`, error);
    }
  }, WORKER_CONFIG.stalledJobTimeout);

  // Log worker metrics periodically
  const metricsInterval = setInterval(() => {
    const uptime = Date.now() - workerMetrics.startTime;
    console.log(`📊 [Worker ${WORKER_CONFIG.id}] Worker performance metrics:`);
    console.log(`  Uptime: ${uptime}ms`);
    console.log(`  Total jobs processed: ${workerMetrics.totalJobsProcessed}`);
    console.log(`  Success rate: ${(workerMetrics.successfulJobs / workerMetrics.totalJobsProcessed) * 100}%`);
    console.log(`  Queue metrics:`);
    console.log(`    Current queue length: ${workerMetrics.queueMetrics.currentQueueLength}`);
    console.log(`    Peak queue length: ${workerMetrics.queueMetrics.peakQueueLength}`);
    console.log(`    Total jobs queued: ${workerMetrics.queueMetrics.totalJobsQueued}`);
    console.log(`    Average wait time: ${workerMetrics.queueMetrics.averageWaitTime}ms`);
    console.log(`    Last processing time: ${workerMetrics.queueMetrics.lastProcessingTime}ms`);
    console.log(`  Errors:`);
    console.log(`    Supabase errors: ${workerMetrics.errors.supabaseErrors}`);
    console.log(`    Processing errors: ${workerMetrics.errors.processingErrors}`);
    console.log(`    Stalled job errors: ${workerMetrics.errors.stalledJobErrors}`);
    console.log(`    Circuit breaker trips: ${workerMetrics.errors.circuitBreakerTrips}`);
  }, 6000000); // Log metrics every 10 minutes

  process.on('SIGTERM', () => {
    clearInterval(stalledJobsInterval);
    clearInterval(metricsInterval);
  });
  process.on('SIGINT', () => {
    clearInterval(stalledJobsInterval);
    clearInterval(metricsInterval);
  });

  try {
    while (true) {
      try {
        await checkForPendingJobs();
      } catch (error) {
        if (error instanceof CircuitBreakerError) {
          console.log(`⚡ [Worker ${WORKER_CONFIG.id}] Circuit breaker triggered, waiting before retry...`);
          await sleep(WORKER_CONFIG.circuitBreakerResetTimeout);
        } else if (error instanceof JobProcessingError) {
          console.error(`❌ [Worker ${WORKER_CONFIG.id}] Job processing error for ${error.jobId}:`, error.message);
          await sleep(WORKER_CONFIG.retryDelay);
        } else if (error instanceof SupabaseError) {
          console.error(`❌ [Worker ${WORKER_CONFIG.id}] Supabase error:`, error.message);
          await sleep(WORKER_CONFIG.retryDelay);
        } else {
          console.error(`💥 [Worker ${WORKER_CONFIG.id}] Unexpected error:`, error);
          await sleep(WORKER_CONFIG.retryDelay);
        }
      }
      await sleep(WORKER_CONFIG.pollingInterval);
    }
  } catch (error) {
    console.error(`💥 [Worker ${WORKER_CONFIG.id}] Fatal error:`, error);
    clearInterval(stalledJobsInterval);
    clearInterval(metricsInterval);
    process.exit(1);
  }
}

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => {
  console.log(`👋 [Worker ${WORKER_CONFIG.id}] Received SIGTERM, shutting down gracefully...`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`👋 [Worker ${WORKER_CONFIG.id}] Received SIGINT, shutting down gracefully...`);
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error(`💥 [Worker ${WORKER_CONFIG.id}] Uncaught exception:`, error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`💥 [Worker ${WORKER_CONFIG.id}] Unhandled rejection:`, reason);
  process.exit(1);
});

startWorker().catch(error => {
  console.error(`💥 [Worker ${WORKER_CONFIG.id}] Fatal error:`, error);
  process.exit(1);
});