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
  pollingInterval: 1000,     // 1 seconde
  stalledJobTimeout: 60000,  // 1 minute
  circuitBreakerResetTimeout: 5000,  // 5 secondes
  retryDelay: 1000,         // 1 seconde
};

// Récupérer la configuration depuis les variables d'environnement
const WORKER_CONFIG: WorkerConfig = {
  id: process.env.WORKER_ID || DEFAULT_CONFIG.id,
  pollingInterval: parseInt(process.env.POLLING_INTERVAL || '') || DEFAULT_CONFIG.pollingInterval,
  stalledJobTimeout: parseInt(process.env.STALLED_JOB_TIMEOUT || '') || DEFAULT_CONFIG.stalledJobTimeout,
  circuitBreakerResetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT || '') || DEFAULT_CONFIG.circuitBreakerResetTimeout,
  retryDelay: parseInt(process.env.RETRY_DELAY || '') || DEFAULT_CONFIG.retryDelay,
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
  console.log(`🔍 [Worker ${WORKER_CONFIG.id}] Checking for stalled jobs...`);
  
  try {
    const { data: jobs, error } = await supabase
      .from('import_jobs')
      .select('*')
      .in('status', ['processing'])
      .order('created_at')
      .limit(1);

    if (error) {
      throw new SupabaseError('Failed to fetch stalled jobs', error);
    }

    if (jobs && jobs.length > 0) {
      const job = jobs[0];
      console.log(`✨ [Worker ${WORKER_CONFIG.id}] Recovering stalled job: ${job.id}`);
      
      try {
        await processJob(job, WORKER_CONFIG.id);
      } catch (err) {
        const error = err as Error;
        throw new StalledJobError(
          `Failed to recover stalled job: ${error?.message || 'Unknown error'}`,
          job.id
        );
      }
    }
  } catch (error) {
    if (error instanceof WorkerError) {
      console.error(`❌ [Worker ${WORKER_CONFIG.id}] ${error.name} (${error.code}):`, error.message);
    } else {
      console.error(`❌ [Worker ${WORKER_CONFIG.id}] Unexpected error:`, error);
    }
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
  console.log(`🚀 [Worker ${WORKER_CONFIG.id}] Starting import worker...`);
  console.log(`📋 [Worker ${WORKER_CONFIG.id}] Configuration:`, WORKER_CONFIG);
  
  // Démarrer la vérification des jobs bloqués en arrière-plan
  const stalledJobsInterval = setInterval(async () => {
    console.log(`🔍 [Worker ${WORKER_CONFIG.id}] Checking for stalled jobs...`);
    try {
      await recoverStalledJobs();
    } catch (error) {
      console.error(`❌ [Worker ${WORKER_CONFIG.id}] Error checking stalled jobs:`, error);
    }
  }, WORKER_CONFIG.stalledJobTimeout);

  // S'assurer que l'intervalle est nettoyé à la sortie
  process.on('SIGTERM', () => clearInterval(stalledJobsInterval));
  process.on('SIGINT', () => clearInterval(stalledJobsInterval));
  
  try {
    while (true) {
      try {
        await safeSupabaseCall(async () => {
          console.log(`🔍 [Worker ${WORKER_CONFIG.id}] Checking for pending jobs...`);
          
          // Prendre un job de manière atomique
          const { data: jobs, error } = await supabase
            .rpc('claim_next_pending_job', {
              worker_id_input: WORKER_CONFIG.id
            });

          if (error) {
            if (error.code === '42P01') {
              console.warn(`⚠️ [Worker ${WORKER_CONFIG.id}] Table import_jobs not found, waiting longer...`);
              await sleep(WORKER_CONFIG.pollingInterval * 2);
              return;
            }
            throw new SupabaseError('Failed to fetch pending jobs', error);
          }

          if (jobs && jobs.length > 0) {
            const job = jobs[0];
            console.log(`✨ [Worker ${WORKER_CONFIG.id}] Processing job: ${job.id} (type: ${job.job_type})`);
            try {
              await processJob(job, WORKER_CONFIG.id);
            } catch (err) {
              const error = err as Error;
              throw new JobProcessingError(
                `Failed to process job: ${error?.message || 'Unknown error'}`,
                job.id
              );
            }
          } else {
            console.log(`💤 [Worker ${WORKER_CONFIG.id}] No pending jobs, waiting...`);
            await sleep(WORKER_CONFIG.pollingInterval);
          }
        });
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
    }
  } catch (error) {
    console.error(`💥 [Worker ${WORKER_CONFIG.id}] Fatal error:`, error);
    clearInterval(stalledJobsInterval);
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