// worker/src/jobManager.ts
import { importJobsRepository } from './repositories/importJobsRepository';
import { RedisJobQueue, ImportJob } from './redisQueue';
import { redisClient } from './redisClient';
import logger from './log_utils';
import * as dotenv from 'dotenv';

dotenv.config();

// Database connection is handled by repositories



export interface JobManagerConfig {
  syncInterval: number; // Intervalle de synchronisation avec Supabase
  batchSize: number;
  maxRetries: number;
}

export class JobManager {
  private queue: RedisJobQueue;
  private redis = redisClient.getClient();
  private config: JobManagerConfig;
  private syncTimer?: NodeJS.Timeout;

  constructor(config: JobManagerConfig = {
    syncInterval: 60000, // 1 minute
    batchSize: 10,
    maxRetries: 3
  }) {
    this.queue = new RedisJobQueue();
    this.config = config;
  }

  /**
   * Démarrer le gestionnaire de jobs
   */
  async start(): Promise<void> {
    try {
      // S'assurer que Redis est connecté
      await redisClient.ensureConnection();
      
      // Synchroniser les jobs existants depuis Supabase vers Redis
      await this.syncJobsFromSupabase();
      
      // Démarrer la synchronisation périodique
      this.startPeriodicSync();
      
      console.log('✅ Job manager started successfully');
      // Runtime diagnostics
      console.log('JobManager', 'runtime', {
        node: process.version,
        undici: (process as any).versions?.undici,
        supabaseJs: undefined // set via separate logger if needed
      });
    } catch (error) {
      console.log('❌ Failed to start job manager:', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  /**
   * Arrêter le gestionnaire de jobs
   */
  async stop(): Promise<void> {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
    
    await redisClient.disconnect();
    console.log('JobManager', 'stop', 'Job manager stopped');
  }

  /**
   * Synchroniser les jobs depuis PostgreSQL vers Redis (migration initiale)
   */
  private async syncJobsFromSupabase(): Promise<void> {
    try {
      // console.log('JobManager', 'syncJobsFromSupabase', 'Starting job synchronization from PostgreSQL');
      
      // Récupérer les jobs pending depuis PostgreSQL
      const pendingJobs = await importJobsRepository.getPendingJobs();

      if (!pendingJobs || pendingJobs.length === 0) {
        // console.log('JobManager', 'syncJobsFromSupabase', 'No pending jobs found in PostgreSQL');
        return;
      }

      // Ajouter chaque job à la queue Redis
      let syncedCount = 0;
      for (const job of pendingJobs) {
        try {
          const importJob: ImportJob = {
            id: job.id,
            user_id: job.user_id,
            status: job.status,
            total_items: job.total_items || 0,
            error_log: job.error_log || undefined,
            file_paths: job.file_paths || [],
            job_type: job.job_type,
            stats: job.stats,
            created_at: job.created_at,
            updated_at: job.updated_at
          };

          await this.queue.enqueueJob(importJob);
          syncedCount++;
        } catch (error) {
          console.log('JobManager', 'syncJobsFromSupabase', 'Failed to sync individual job', {
            jobId: job.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log('JobManager', 'syncJobsFromSupabase', 'Job synchronization completed', {
        totalJobs: pendingJobs.length,
        syncedJobs: syncedCount
      });
    } catch (error) {
      console.log('JobManager', 'syncJobsFromSupabase', 'Failed to sync jobs from PostgreSQL', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Démarrer la synchronisation périodique
   */
  private startPeriodicSync(): void {
    this.syncTimer = setInterval(async () => {
      try {
        await this.syncJobsFromSupabase();
        await this.syncJobStatusToSupabase();
      } catch (error) {
        console.log('JobManager', 'periodicSync', 'Periodic sync failed', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }, this.config.syncInterval);

    console.log('JobManager', 'startPeriodicSync', 'Periodic sync started', {
      interval: this.config.syncInterval
    });
  }

  /**
   * Synchroniser les statuts des jobs vers PostgreSQL
   */
  private async syncJobStatusToSupabase(): Promise<void> {
    try {
      // Récupérer les jobs completed et failed depuis Redis
      const completedJobs = await this.redis.lrange('jobs:completed', 0, this.config.batchSize - 1);
      const failedJobs = await this.redis.lrange('jobs:failed', 0, this.config.batchSize - 1);

      // Traiter les jobs completed
      for (const jobStr of completedJobs) {
        try {
          const job = JSON.parse(jobStr);
          await this.updateJobInSupabase(job.id, 'completed', job.stats, null);
          
          // Retirer le job de Redis après synchronisation
          await this.redis.lrem('jobs:completed', 1, jobStr);
        } catch (error) {
          console.log('JobManager', 'syncJobStatusToSupabase', 'Failed to sync completed job', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Traiter les jobs failed
      for (const jobStr of failedJobs) {
        try {
          const job = JSON.parse(jobStr);
          await this.updateJobInSupabase(job.id, 'failed', null, job.error_log);
          
          // Retirer le job de Redis après synchronisation
          await this.redis.lrem('jobs:failed', 1, jobStr);
        } catch (error) {
          console.log('JobManager', 'syncJobStatusToSupabase', 'Failed to sync failed job', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      if (completedJobs.length > 0 || failedJobs.length > 0) {
        console.log('JobManager', 'syncJobStatusToSupabase', 'Job status sync completed', {
          completedJobs: completedJobs.length,
          failedJobs: failedJobs.length
        });
      }
    } catch (error) {
      console.log('JobManager', 'syncJobStatusToSupabase', 'Failed to sync job status to PostgreSQL', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mettre à jour un job dans PostgreSQL
   */
  private async updateJobInSupabase(
    jobId: string, 
    status: 'completed' | 'failed' | 'processing',
    stats?: any,
    errorLog?: string | null
  ): Promise<void> {
    try {
      const opId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      console.log('JobManager', 'updateJobInSupabase:request', {
        opId,
        jobId,
        status,
        hasStats: !!stats,
        hasErrorLog: !!errorLog
      });

      await importJobsRepository.updateJobStatus(jobId, status, stats, errorLog);

      console.log('JobManager', 'updateJobInSupabase:response', {
        opId,
        jobId,
        status,
        hasStats: !!stats,
        hasError: !!errorLog
      });
    } catch (error) {
      console.log('JobManager', 'updateJobInSupabase', 'Failed to update job in PostgreSQL', {
        jobId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: (error as any)?.stack
      });
      throw error;
    }
  }

  /**
   * Récupérer le prochain job à traiter
   */
  async getNextJob(workerId: string): Promise<ImportJob | null> {
    try {
      const job = await this.queue.dequeueJob(workerId, 30);
      
      if (job) {
        // Mettre à jour le statut dans Supabase
        console.log('JobManager', 'getNextJob:update:start', { workerId, jobId: job.id });
        try {
          await this.updateJobInSupabase(job.id, 'processing');
          console.log('JobManager', 'getNextJob:update:success', { workerId, jobId: job.id });
        } catch (e) {
          console.log('JobManager', 'getNextJob:update:error', { workerId, jobId: job.id, error: e instanceof Error ? e.message : String(e), stack: (e as any)?.stack });
          throw e;
        }
      }
      
      return job;
    } catch (error) {
      console.log('JobManager', 'getNextJob', 'Failed to get next job', {
        workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Marquer un job comme terminé
   */
  async completeJob(jobId: string, workerId: string, stats: any): Promise<void> {
    try {
      await this.queue.completeJob(jobId, workerId, stats);
      console.log('JobManager', 'completeJob', 'Job marked as completed', {
        jobId,
        workerId
      });
    } catch (error) {
      console.log('JobManager', 'completeJob', 'Failed to complete job', {
        jobId,
        workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Marquer un job comme échoué
   */
  async failJob(jobId: string, workerId: string, errorMessage: string): Promise<void> {
    try {
      await this.queue.failJob(jobId, workerId, errorMessage);
      console.log('JobManager', 'failJob', 'Job marked as failed', {
        jobId,
        workerId,
        error: errorMessage
      });
    } catch (error) {
      console.log('JobManager', 'failJob', 'Failed to mark job as failed', {
        jobId,
        workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Récupérer les métriques de la queue
   */
  async getMetrics() {
    return await this.queue.getQueueMetrics();
  }

  /**
   * Nettoyer les anciens jobs
   */
  async cleanup(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    await this.queue.cleanupOldJobs(maxAge);
  }
}
