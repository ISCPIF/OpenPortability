// worker/src/redisQueue.ts
import { redisClient } from './redisClient';
import logger from './log_utils';

export interface ImportJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  error_log?: string;
  file_paths: string[];
  job_type?: 'large_file_import' | 'direct_import';
  stats?: {
    followers: { processed: number; total: number };
    following: { processed: number; total: number };
  };
  created_at?: string;
  updated_at?: string;
}

export interface QueueMetrics {
  pendingJobs: number;
  processingJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalJobsProcessed: number;
}

export class RedisJobQueue {
  private redis = redisClient.getClient();
  private readonly QUEUE_KEYS = {
    PENDING: 'jobs:pending',
    PROCESSING: 'jobs:processing',
    COMPLETED: 'jobs:completed',
    FAILED: 'jobs:failed',
    NOTIFICATIONS: 'jobs:notifications'
  };

  constructor() {
    // S'assurer que Redis est connecté
    this.ensureConnection();
  }

  private async ensureConnection(): Promise<void> {
    await redisClient.ensureConnection();
  }

  /**
   * Ajouter un job à la queue (appelé depuis l'API)
   */
  async enqueueJob(job: ImportJob): Promise<void> {
    try {
      await this.ensureConnection();
      
      // Ajouter le job à la queue pending
      await this.redis.lpush(this.QUEUE_KEYS.PENDING, JSON.stringify(job));
      
      // Publier une notification pour réveiller les workers
      await this.redis.publish(this.QUEUE_KEYS.NOTIFICATIONS, JSON.stringify({
        type: 'new_job',
        jobId: job.id,
        timestamp: Date.now()
      }));

      console.log('RedisJobQueue', 'enqueueJob', 'Job added to queue', {
        jobId: job.id,
        userId: job.user_id,
        jobType: job.job_type
      });
    } catch (error) {
      console.log('RedisJobQueue', 'enqueueJob', 'Failed to enqueue job', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Récupérer le prochain job (remplace le polling Supabase)
   * Utilise BRPOP pour un comportement bloquant
   */
  async dequeueJob(workerId: string, timeoutSeconds: number = 30): Promise<ImportJob | null> {
    try {
      await this.ensureConnection();
      
      // BRPOP bloque jusqu'à ce qu'un job soit disponible ou timeout
      const result = await this.redis.brpop(this.QUEUE_KEYS.PENDING, timeoutSeconds);
      
      if (!result) {
        // Timeout - pas de job disponible
        return null;
      }

      const job: ImportJob = JSON.parse(result[1]);
      
      // Déplacer le job vers la queue processing
      await this.moveJobToProcessing(job, workerId);
      
      console.log('RedisJobQueue', 'dequeueJob', 'Job dequeued for processing', {
        jobId: job.id,
        workerId,
        userId: job.user_id
      });

      return job;
    } catch (error) {
      console.log('RedisJobQueue', 'dequeueJob', 'Failed to dequeue job', {
        workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Déplacer un job vers la queue processing
   */
  private async moveJobToProcessing(job: ImportJob, workerId: string): Promise<void> {
    const processingJob = {
      ...job,
      status: 'processing' as const,
      workerId,
      startedAt: new Date().toISOString()
    };

    await this.redis.lpush(this.QUEUE_KEYS.PROCESSING, JSON.stringify(processingJob));
  }

  /**
   * Marquer un job comme terminé avec succès
   */
  async completeJob(jobId: string, workerId: string, stats?: any): Promise<void> {
    try {
      await this.ensureConnection();
      
      // Retirer le job de la queue processing
      const processingJob = await this.removeJobFromProcessing(jobId, workerId);
      
      if (processingJob) {
        const completedJob = {
          ...processingJob,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
          stats
        };

        // Ajouter à la queue completed
        await this.redis.lpush(this.QUEUE_KEYS.COMPLETED, JSON.stringify(completedJob));
        
        // Publier notification de completion
        await this.redis.publish(this.QUEUE_KEYS.NOTIFICATIONS, JSON.stringify({
          type: 'job_completed',
          jobId,
          workerId,
          timestamp: Date.now()
        }));
        
        // Stocker le job complété avec toutes les infos pour l'API
        const completedJobData = {
          id: jobId,
          user_id: processingJob.user_id,
          status: 'completed',
          total_items: processingJob.total_items,
          stats: stats,
          error_log: null,
          updated_at: new Date().toISOString()
        };
        
        await this.redis.set(`job:${jobId}`, JSON.stringify(completedJobData), 'EX', 3600); // 1h TTL
        
        console.log('RedisJobQueue', 'completeJob', 'Job completed successfully', {
          jobId,
          workerId,
          stats
        });
      }
    } catch (error) {
      console.log('RedisJobQueue', 'completeJob', 'Failed to complete job', {
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
      await this.ensureConnection();
      
      // Retirer le job de la queue processing
      const processingJob = await this.removeJobFromProcessing(jobId, workerId);
      
      if (processingJob) {
        const failedJob = {
          ...processingJob,
          status: 'failed' as const,
          failedAt: new Date().toISOString(),
          error_log: errorMessage
        };

        // Ajouter à la queue failed
        await this.redis.lpush(this.QUEUE_KEYS.FAILED, JSON.stringify(failedJob));
        
        // Publier notification d'échec
        await this.redis.publish(this.QUEUE_KEYS.NOTIFICATIONS, JSON.stringify({
          type: 'job_failed',
          jobId,
          workerId,
          error: errorMessage,
          timestamp: Date.now()
        }));
        
        // Stocker le job échoué pour l'API
        const failedJobData = {
          id: jobId,
          user_id: processingJob.user_id,
          status: 'failed',
          total_items: processingJob.total_items,
          stats: processingJob.stats || {},
          error_log: errorMessage,
          updated_at: new Date().toISOString()
        };
        
        await this.redis.set(`job:${jobId}`, JSON.stringify(failedJobData), 'EX', 3600); // 1h TTL
        
        console.log('RedisJobQueue', 'failJob', 'Job failed', {
          jobId,
          workerId,
          error: errorMessage
        });
      }
    } catch (error) {
      console.log('RedisJobQueue', 'failJob', 'Failed to mark job as failed', {
        jobId,
        workerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Retirer un job de la queue processing
   */
  private async removeJobFromProcessing(jobId: string, workerId: string): Promise<any | null> {
    // Récupérer tous les jobs en cours de traitement
    const processingJobs = await this.redis.lrange(this.QUEUE_KEYS.PROCESSING, 0, -1);
    
    for (let i = 0; i < processingJobs.length; i++) {
      const job = JSON.parse(processingJobs[i]);
      if (job.id === jobId && job.workerId === workerId) {
        // Retirer le job de la liste
        await this.redis.lrem(this.QUEUE_KEYS.PROCESSING, 1, processingJobs[i]);
        return job;
      }
    }
    
    console.log('RedisJobQueue', 'removeJobFromProcessing', 'Job not found in processing queue', {
      jobId,
      workerId
    });
    return null;
  }

  /**
   * Récupérer les métriques de la queue
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      await this.ensureConnection();
      
      const [pending, processing, completed, failed] = await Promise.all([
        this.redis.llen(this.QUEUE_KEYS.PENDING),
        this.redis.llen(this.QUEUE_KEYS.PROCESSING),
        this.redis.llen(this.QUEUE_KEYS.COMPLETED),
        this.redis.llen(this.QUEUE_KEYS.FAILED)
      ]);

      return {
        pendingJobs: pending,
        processingJobs: processing,
        completedJobs: completed,
        failedJobs: failed,
        totalJobsProcessed: completed + failed
      };
    } catch (error) {
      console.log('RedisJobQueue', 'getQueueMetrics', 'Failed to get queue metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Nettoyer les anciennes entrées (maintenance)
   */
  async cleanupOldJobs(maxAge: number = 24 * 60 * 60 * 1000): Promise<void> {
    try {
      await this.ensureConnection();
      
      const cutoffTime = Date.now() - maxAge;
      
      for (const queueKey of [this.QUEUE_KEYS.COMPLETED, this.QUEUE_KEYS.FAILED]) {
        const jobs = await this.redis.lrange(queueKey, 0, -1);
        let removedCount = 0;
        
        for (const jobStr of jobs) {
          const job = JSON.parse(jobStr);
          const jobTime = new Date(job.completedAt || job.failedAt || 0).getTime();
          
          if (jobTime < cutoffTime) {
            await this.redis.lrem(queueKey, 1, jobStr);
            removedCount++;
          }
        }
        
        if (removedCount > 0) {
          console.log('RedisJobQueue', 'cleanupOldJobs', 'Cleaned up old jobs', {
            queue: queueKey,
            removedCount
          });
        }
      }
    } catch (error) {
      console.log('RedisJobQueue', 'cleanupOldJobs', 'Failed to cleanup old jobs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Récupérer les jobs en cours de traitement (pour monitoring)
   */
  async getProcessingJobs(): Promise<ImportJob[]> {
    try {
      await this.ensureConnection();
      
      const jobs = await this.redis.lrange(this.QUEUE_KEYS.PROCESSING, 0, -1);
      return jobs.map(jobStr => JSON.parse(jobStr));
    } catch (error) {
      console.log('RedisJobQueue', 'getProcessingJobs', 'Failed to get processing jobs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return [];
    }
  }
}
