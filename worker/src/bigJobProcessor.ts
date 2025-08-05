import { promises as fs } from 'fs';
import { JobManager } from './jobManager';
import { convertTwitterDataToCSV, importCSVViaPsql, updateJobProgress, executePostgresCommand } from './jobProcessor';
import logger from './log_utils';

interface ChunkProgress {
  chunkIndex: number;
  totalChunks: number;
  recordsProcessed: number;
  totalRecords: number;
  workerId: string;
}

interface BigJobResult {
  success: boolean;
  totalProcessed: number;
  chunksCompleted: number;
  totalChunks: number;
  executionTime: number;
  parallelWorkers: number;
  error?: string;
}

interface ChunkJob {
  chunkId: string;
  data: any[];
  dataType: 'followers' | 'targets';
  userId: string;
  chunkIndex: number;
  totalChunks: number;
}

// Optimized constants for big jobs
const CHUNK_SIZE = 25000; // Garder pour targets
const FOLLOWERS_CHUNK_SIZE = 10000; // Nouveau: plus petit pour followers
const MAX_PARALLEL_WORKERS = 3; // Réduire drastiquement
const BIG_JOB_THRESHOLD = 100000; // 100k records triggers big job mode

export class BigJobProcessor {
  private jobManager: JobManager;
  private workerId: string;
  private activeChunks: Map<string, ChunkProgress> = new Map();

  constructor(jobManager: JobManager, workerId: string) {
    this.jobManager = jobManager;
    this.workerId = workerId;
  }

  /**
   * Determine if a job should use big processing based on data size
   */
  static shouldUseBigProcessor(followersCount: number, followingCount: number): boolean {
    const totalRecords = followersCount + followingCount;
    return totalRecords >= BIG_JOB_THRESHOLD;
  }

  /**
   * Process large datasets with parallel chunking and optimized triggers
   */
  async processBigJob(
    jobId: string,
    userId: string,
    followersData: any[],
    followingData: any[]
  ): Promise<BigJobResult> {
    const startTime = Date.now();
    const totalRecords = followersData.length + followingData.length;
    
    try {
      console.log(`[BigWorker ${this.workerId}] 🚀 Starting big job processing`, {
        jobId,
        followersCount: followersData.length,
        followingCount: followingData.length,
        totalRecords
      });

      // Update job status to processing
      await updateJobProgress(
        jobId, 
        { followers: 0, following: 0 }, 
        { followers: followersData.length, following: followingData.length }, 
        this.workerId, 
        'processing'
      );
      
      // STEP 0: Disable ALL triggers ONCE before any processing
      console.log(`[BigWorker ${this.workerId}] 🔧 Step 0: Disabling all triggers for big job...`);
      await this.disableAllTriggers();
      
      // Create chunk jobs for parallel processing
      const chunkJobs = this.createChunkJobs(followersData, followingData, userId);
      const totalChunks = chunkJobs.length;
      
      // Calculate optimal worker count (don't exceed available workers or chunks)
      const optimalWorkers = Math.min(MAX_PARALLEL_WORKERS, totalChunks, 3);
      
      console.log(`[BigWorker ${this.workerId}] 📦 Processing strategy`, {
        totalChunks,
        chunkSize: CHUNK_SIZE,
        parallelWorkers: optimalWorkers,
        estimatedTime: `${Math.ceil(totalRecords / (107 * optimalWorkers))}s`
      });

      // Process chunks in parallel batches
      const results = await this.processChunksInParallel(chunkJobs, optimalWorkers, jobId);
      
      // STEP FINAL: Re-enable ALL triggers ONCE after all processing
      console.log(`[BigWorker ${this.workerId}] 🔧 Final Step: Re-enabling all triggers after big job...`);
      await this.enableAllTriggers();
      
      const executionTime = Date.now() - startTime;
      const totalProcessed = results.reduce((sum, r) => sum + r.processed, 0);
      const chunksCompleted = results.filter(r => r.success).length;

      console.log(`[BigWorker ${this.workerId}] 🎉 Big job completed`, {
        jobId,
        totalProcessed,
        chunksCompleted,
        totalChunks,
        executionTime: `${executionTime}ms`,
        throughput: `${Math.round(totalProcessed / (executionTime / 1000))} records/sec`
      });

      return {
        success: true,
        totalProcessed,
        chunksCompleted,
        totalChunks,
        executionTime,
        parallelWorkers: optimalWorkers
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Emergency: Re-enable triggers in case of error
      console.log(`[BigWorker ${this.workerId}] 🚨 Emergency: Re-enabling triggers after error...`);
      try {
        await this.enableAllTriggers();
      } catch (triggerError) {
        console.log(`[BigWorker ${this.workerId}] ❌ Failed to re-enable triggers:`, triggerError);
      }
      
      console.log(`[BigWorker ${this.workerId}] ❌ Big job failed`, {
        jobId,
        error: errorMessage,
        executionTime: `${executionTime}ms`
      });
      
      return {
        success: false,
        totalProcessed: 0,
        chunksCompleted: 0,
        totalChunks: 0,
        executionTime,
        parallelWorkers: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Create chunk jobs from followers and following data
   */
  private createChunkJobs(followersData: any[], followingData: any[], userId: string): ChunkJob[] {
    const chunkJobs: ChunkJob[] = [];
    let chunkIndex = 0;
  
    // Followers: Keep current size (low index overhead)
    const followerChunks = this.createChunks(followersData, FOLLOWERS_CHUNK_SIZE);
    for (const chunk of followerChunks) {
      chunkJobs.push({
        chunkId: `followers_${chunkIndex}_${Date.now()}`,
        data: chunk,
        dataType: 'followers',
        userId,
        chunkIndex: chunkIndex++,
        totalChunks: 0,
        // priority: 'high' // Process followers first
      });
    }
  
    // Targets: Reduce chunk size significantly (high index overhead)
    const targetChunks = this.createChunks(followingData, 5000); // Reduced from 25000
    for (const chunk of targetChunks) {
      chunkJobs.push({
        chunkId: `targets_${chunkIndex}_${Date.now()}`,
        data: chunk,
        dataType: 'targets',  
        userId,
        chunkIndex: chunkIndex++,
        totalChunks: 0,
        // priority: 'low' // Process targets after followers
      });
    }
  
    chunkJobs.forEach(job => job.totalChunks = chunkJobs.length);
    return chunkJobs;
  }

  /**
   * Process chunks in parallel with controlled concurrency
   */
  private async processChunksInParallel(
    chunkJobs: ChunkJob[],
    maxWorkers: number,
    jobId: string
  ): Promise<Array<{ success: boolean; processed: number; error?: string }>> {
    const results: Array<{ success: boolean; processed: number; error?: string }> = [];
    const activePromises: Promise<any>[] = [];
    let completedChunks = 0;

    for (let i = 0; i < chunkJobs.length; i++) {
      const chunkJob = chunkJobs[i];
      
      // Create chunk processing promise
      const chunkPromise = this.processChunkJob(chunkJob, jobId)
        .then(async (result) => {
          completedChunks++;
          
          // Update job progress
          const followersProcessed = results
            .filter(r => r.success && chunkJob.dataType === 'followers')
            .reduce((sum, r) => sum + r.processed, 0) + (result.success && chunkJob.dataType === 'followers' ? result.processed : 0);
          
          const targetsProcessed = results
            .filter(r => r.success && chunkJob.dataType === 'targets')
            .reduce((sum, r) => sum + r.processed, 0) + (result.success && chunkJob.dataType === 'targets' ? result.processed : 0);
          
            await updateJobProgress(
                jobId, 
                { followers: followersProcessed, following: targetsProcessed }, 
                { 
                  followers: chunkJobs.filter(job => job.dataType === 'followers').reduce((sum, job) => sum + job.data.length, 0),
                  following: chunkJobs.filter(job => job.dataType === 'targets').reduce((sum, job) => sum + job.data.length, 0)
                }, 
                this.workerId, 
                'processing'
              );
          
          return result;
        });

      activePromises.push(chunkPromise);

      // Control concurrency - wait if we've reached max workers
      if (activePromises.length >= maxWorkers || i === chunkJobs.length - 1) {
        const batchResults = await Promise.all(activePromises);
        results.push(...batchResults);
        activePromises.length = 0; // Clear the array
      }
    }

    return results;
  }

  /**
   * Process a single chunk job
   */
  private async processChunkJob(chunkJob: ChunkJob, jobId: string): Promise<{ success: boolean; processed: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Convert data to CSV content (no file I/O)
      const { dataContent, relationsContent } = await convertTwitterDataToCSV(
        chunkJob.data,
        chunkJob.userId,
        chunkJob.dataType,
        this.workerId
      );
      
      // Import via psql with trigger management skipped (handled centrally)
      const result = await importCSVViaPsql(
        dataContent,
        relationsContent,
        chunkJob.dataType,
        chunkJob.userId,
        this.workerId,
        true // skipTriggerManagement=true
      );
      
      const executionTime = Date.now() - startTime;
      
      if (result.success) {
        const throughput = Math.round((result.processed / executionTime) * 1000);
        console.log(`[BigWorker ${this.workerId}] ✅ Chunk completed {`);
        console.log(`  chunkId: '${chunkJob.chunkId}',`);
        console.log(`  processed: ${result.processed},`);
        console.log(`  executionTime: '${executionTime}ms',`);
        console.log(`  throughput: '${throughput} records/sec'`);
        console.log(`}`);
        
        return { success: true, processed: result.processed };
      } else {
        console.log(`[BigWorker ${this.workerId}] ❌ Chunk failed {`);
        console.log(`  chunkId: '${chunkJob.chunkId}',`);
        console.log(`  error: '${result.error}',`);
        console.log(`  executionTime: '${executionTime}ms'`);
        console.log(`}`);
        
        return { success: false, processed: 0, error: result.error };
      }
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.log(`[BigWorker ${this.workerId}] ❌ Chunk failed {`);
      console.log(`  chunkId: '${chunkJob.chunkId}',`);
      console.log(`  error: '${errorMessage}',`);
      console.log(`  executionTime: '${executionTime}ms'`);
      console.log(`}`);
      
      return { success: false, processed: 0, error: errorMessage };
    }
  }

  /**
   * Split data into chunks
   */
  private createChunks<T>(data: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Disable all triggers once for the entire big job
   */
  private async disableAllTriggers(): Promise<void> {
    const disableSQL = `
      -- Optimisation des paramètres PostgreSQL pour les gros imports (session-level uniquement)
      SET statement_timeout TO '180s';
      SET work_mem TO '64MB';
      SET maintenance_work_mem TO '512MB';
      SET temp_buffers TO '32MB';
      
      -- Désactivation des triggers pour éviter les overhead
      ALTER TABLE sources_followers DISABLE TRIGGER sources_followers_stats_trigger;
      ALTER TABLE sources_targets DISABLE TRIGGER sources_targets_stats_trigger;
      ALTER TABLE sources_targets DISABLE TRIGGER trigger_check_new_sources_targets_bluesky;
      ALTER TABLE sources_targets DISABLE TRIGGER trigger_check_new_sources_targets_mastodon;
    `;
    
    const result = await executePostgresCommand(disableSQL, this.workerId, 90000); // 90s timeout for trigger management
    if (!result.success) {
      throw new Error(`Failed to disable triggers and optimize session: ${result.error}`);
    }
    console.log(`[BigWorker ${this.workerId}] ✅ All triggers disabled and session optimized for big job`);
  }

  /**
   * Re-enable all triggers once after the entire big job
   */
  private async enableAllTriggers(): Promise<void> {
    const enableSQL = `
      SET statement_timeout TO '60s';
      ALTER TABLE sources_followers ENABLE TRIGGER sources_followers_stats_trigger;
      ALTER TABLE sources_targets ENABLE TRIGGER sources_targets_stats_trigger;
      ALTER TABLE sources_targets ENABLE TRIGGER trigger_check_new_sources_targets_bluesky;
      ALTER TABLE sources_targets ENABLE TRIGGER trigger_check_new_sources_targets_mastodon;
    `;
    
    const result = await executePostgresCommand(enableSQL, this.workerId, 90000); // 90s timeout for trigger management
    if (!result.success) {
      console.log(`[BigWorker ${this.workerId}] ⚠️ Warning: Failed to re-enable triggers: ${result.error}`);
    } else {
      console.log(`[BigWorker ${this.workerId}] ✅ All triggers re-enabled after big job`);
    }
  }
}
