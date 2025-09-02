// worker/src/jobManager.ts
import { createClient } from '@supabase/supabase-js';
import { RedisJobQueue, ImportJob } from './redisQueue';
import { redisClient } from './redisClient';
import logger from './log_utils';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

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
   * Synchroniser les jobs depuis Supabase vers Redis (migration initiale)
   */
  private async syncJobsFromSupabase(): Promise<void> {
    try {
      // console.log('JobManager', 'syncJobsFromSupabase', 'Starting job synchronization from Supabase');
      
      // Récupérer les jobs pending depuis Supabase
      const { data: pendingJobs, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch pending jobs: ${error.message}`);
      }

      if (!pendingJobs || pendingJobs.length === 0) {
        // console.log('JobManager', 'syncJobsFromSupabase', 'No pending jobs found in Supabase');
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
            error_log: job.error_log,
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
      console.log('JobManager', 'syncJobsFromSupabase', 'Failed to sync jobs from Supabase', {
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
   * Synchroniser les statuts des jobs vers Supabase
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
      console.log('JobManager', 'syncJobStatusToSupabase', 'Failed to sync job status to Supabase', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Mettre à jour un job dans Supabase
   */
  private async updateJobInSupabase(
    jobId: string, 
    status: 'completed' | 'failed' | 'processing',
    stats?: any,
    errorLog?: string | null
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (stats) {
        updateData.stats = stats;
      }

      if (errorLog) {
        updateData.error_log = errorLog;
      }

      const { error } = await supabase
        .from('import_jobs')
        .update(updateData)
        .eq('id', jobId);

      if (error) {
        throw new Error(`Failed to update job ${jobId}: ${error.message}`);
      }

      console.log('JobManager', 'updateJobInSupabase', 'Job updated in Supabase', {
        jobId,
        status,
        hasStats: !!stats,
        hasError: !!errorLog
      });
    } catch (error) {
      console.log('JobManager', 'updateJobInSupabase', 'Failed to update job in Supabase', {
        jobId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
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
        await this.updateJobInSupabase(job.id, 'processing');
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
