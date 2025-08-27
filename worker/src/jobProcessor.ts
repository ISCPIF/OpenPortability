// worker/src/jobProcessor.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFile, unlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { createWriteStream, existsSync, promises as fs } from 'fs';
import { sleep } from './utils';
import logger from './log_utils';
import { exec } from 'child_process';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { JobManager } from './jobManager';
import { convertTwitterDataToCSV, importCSVViaPsql, preloadNodesOnce } from './csvUtils';
import { WorkerPool, WorkerPoolResult } from './workerPool';
import { updateJobStats as updateRedisJobStats, RedisJobStats } from './redisClient';



// Charger les variables d'environnement
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const UPLOADS_DIR = '/app/tmp/uploads';

// Stratégie d'import
const MONOLITHIC_THRESHOLD = 1000000; // 1M records
const PARALLEL_WORKERS = 3;
const PARALLEL_CHUNK_SIZE = 1000;

// Constantes pour le batch parallel import
const FOLLOWERS_CHUNK_SIZE = 10000; // Taille des chunks pour followers (optimized for checkpoints)
const TARGETS_CHUNK_SIZE = 20000;   // Taille des chunks pour targets/following
const BATCH_CONCURRENCY = 1;        // Nombre de workers parallèles

// S'assurer que les dossiers existent
if (!existsSync(UPLOADS_DIR)) {
  fs.mkdir(UPLOADS_DIR, { recursive: true });
}

if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
  process.exit(1);
}

interface LockData {
  workerId: string;
  timestamp: number;
}

async function cleanupTempFiles(filePaths: string[], workerId: string) {
  if (!filePaths || filePaths.length === 0) {
    return;
  }
  
  const userDir = dirname(filePaths[0]);
  
  try {
    for (const path of filePaths) {
      try {
        await fs.unlink(path);
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        console.log(
          'JobProcessor',
          'cleanupTempFiles',
          `Error deleting file`,
          workerId,
          { path, errorCode: err.code },
          err
        );
        
        if (err.code !== 'ENOENT') {
          await sleep(100);
        }
      }
    }
    
    try {
      const files = await fs.readdir(userDir);
      if (files.length === 0) {
        await fs.rmdir(userDir);
        console.log(
          'JobProcessor',
          'cleanupTempFiles',
          `Removed empty directory`,
          workerId,
          { userDir }
        );
      }
    } catch (error) {
      // Directory not empty or other error, ignore
    }
    
  } catch (error) {
    console.log(
      'JobProcessor',
      'cleanupTempFiles',
      `Error during cleanup`,
      workerId,
      { userDir },
      error as Error
    );
  }
}

async function updateJobProgress(
  jobId: string, 
  processedItems: { followers: number; following: number }, 
  totalItems: { followers: number; following: number }, 
  workerId: string,
  status: 'processing' | 'completed' | 'failed' = 'processing',
  errorMessage?: string
) {
  try {
    // Structure stats pour la DB (format complexe)
    const stats = {
      followers: {
        processed: processedItems.followers,
        total: totalItems.followers
      },
      following: {
        processed: processedItems.following,
        total: totalItems.following
      }
    };

    const updateData: any = {
      processed_items: processedItems.followers + processedItems.following,
      total_items: totalItems.followers + totalItems.following,
      stats: stats,
      updated_at: new Date().toISOString()
    };

    if (status !== 'processing') {
      updateData.status = status;
    }

    if (errorMessage) {
      updateData.error_log = errorMessage;
    }

    await supabase
      .from('import_jobs')
      .update(updateData)
      .eq('id', jobId);

  } catch (error) {
    console.log(`[Worker ${workerId}] Error updating job progress:`, error);
  }
}

interface JobMetrics {
  startTime: number;
  endTime?: number;
  totalItems: number;
  processedItemsFollowers: number;
  processedItemsFollowing: number;
  batchesProcessed: number;
  successfulBatches: number;
  failedBatches: number;
  retries: number;
}



const jobMetrics: Map<string, JobMetrics> = new Map();

const supabase = createClient(supabaseUrl, supabaseKey, 
  {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const timeout = 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        return fetch(input, { ...init, signal: controller.signal })
          .finally(() => clearTimeout(timeoutId));
      }
    }
  });

const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});

function validateTwitterData(content: string, type: 'following' | 'follower'): string | null {
  const prefix = `window.YTD.${type}.part0 = `;
  
  if (!content.startsWith(prefix)) {
    return `Invalid file format: ${type}.js must start with "${prefix}"`;
  }

  try {
    const jsonStr = content.substring(prefix.length);
    const data = JSON.parse(jsonStr);

    if (!Array.isArray(data)) {
      return `Invalid ${type} data: not an array`;
    }

    // Ne valider que le premier élément pour éviter la récursion
    if (data.length > 0) {
      const firstItem = data[0];
      const item = firstItem[type];
      if (!item) {
        return `Invalid ${type} data structure`;
      }

      const { accountId, userLink } = item;
      if (!accountId || !userLink) {
        return `Missing required fields in ${type} data`;
      }

      const expectedUserLink = `https://twitter.com/intent/user?user_id=${accountId}`;
      if (userLink !== expectedUserLink) {
        return `Invalid userLink format in ${type} data`;
      }
    }

    return null;
  } catch (error) {
    return `Invalid JSON in ${type}.js: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

}

async function processTwitterFile(filePath: string, workerId: string): Promise<any[]> {
  try {
    const content = await readFile(filePath, 'utf-8');
    const type = filePath.toLowerCase().includes('following') ? 'following' : 'follower';
    
    // Valider le contenu
    const error = validateTwitterData(content, type);
    if (error) {
      throw new Error(error);
    }

    // Parser le JSON depuis le format Twitter JavaScript
    const prefix = `window.YTD.${type}.part0 = `;
    const jsonStr = content.substring(prefix.length);
    const data = JSON.parse(jsonStr);
    
    console.log(`[Worker ${workerId}] Successfully parsed ${data.length} items from ${filePath}`);
    return data;
  } catch (error) {
    console.log(`[Worker ${workerId}] Error reading file ${filePath}:`, error);
    throw error;
  }
}

async function ensureSourceExists(userId: string, workerId: string) {
  try {
    const { data: existingSource } = await supabase
      .from('sources')
      .select('id')
      .eq('id', userId)
      .single();

    if (!existingSource) {
      const { error } = await supabase
        .from('sources')
        .insert([{ id: userId }]);

      if (error && error.code !== '23505') {
        throw error;
      }
    }
  } catch (error) {
    console.log(`[Worker ${workerId}] Error ensuring source exists:`, error);
    throw error;
  }
}

interface JobStats {
  followers: {
    processed: number;
    total: number;
  };
  following: {
    processed: number;
    total: number;
  };
}

interface ImportJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_items: number;
  error_log?: string;
  file_paths: string[];
  job_type?: 'large_file_import' | 'direct_import';
  stats?: JobStats;
}

export async function processJob(job: ImportJob, workerId: string): Promise<{
  followers: number;
  following: number;
  total: number;
  processed: number;
}> {
  const startTime = Date.now();
  console.log(`[Worker ${workerId}] 🚀 Starting job ${job.id} for user ${job.user_id}`);

  try {
    await ensureSourceExists(job.user_id, workerId);

    let followersData: any[] = [];
    let followingData: any[] = [];

    for (const filePath of job.file_paths) {
      const data = await processTwitterFile(filePath, workerId);
      
      if (filePath.includes('follower')) {
        followersData = followersData.concat(data);
      } else if (filePath.includes('following')) {
        followingData = followingData.concat(data);
      }
    }

    const totalRecords = followersData.length + followingData.length;
    console.log(`[Worker ${workerId}] 📊 Processing ${totalRecords.toLocaleString()} total records (${followersData.length} followers, ${followingData.length} following)`);

    // Phase 1: Preload all unique nodes once per job
    if (totalRecords > 0) {
      const t0 = Date.now();
      const followersIds = followersData.map((it: any) => String((it.follower || it.following).accountId));
      const followingIds = followingData.map((it: any) => String((it.following || it.follower).accountId));
      const uniqueIds = Array.from(new Set<string>([...followersIds, ...followingIds]));
      const nodesCSV = ['twitter_id', ...uniqueIds.map(id => `"${id}"`)].join('\n');
      console.log(`[Worker ${workerId}] 🔧 Preloading nodes once | Unique IDs: ${uniqueIds.length.toLocaleString()}`);
      const preloadRes = await preloadNodesOnce(nodesCSV, workerId);
      if (!preloadRes.success) {
        throw new Error(`Preload nodes failed: ${preloadRes.error}`);
      }
      const t1 = Date.now();
      console.log(`[Worker ${workerId}] ✅ Nodes preloaded in ${t1 - t0}ms`);
    }

    const strategy = getOptimalStrategy(totalRecords);
    console.log(`[Worker ${workerId}] 🎯 Using ${strategy} strategy`);

    // let result;
    // if (strategy === 'monolithic') {
    //   result = await processMonolithicImport(followersData, followingData, job.user_id, workerId);
    // } else {
    const result = await processBatchParallelImport(followersData, followingData, job.user_id, workerId, job.id);
    // }

    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }

    await updateJobProgress(
      job.id,
      { followers: followersData.length, following: followingData.length },
      { followers: followersData.length, following: followingData.length },
      workerId,
      'completed'
    );

    const executionTime = Date.now() - startTime;
    // console.log(`[Worker ${workerId}] ✅ Job ${job.id} completed in ${executionTime}ms`);

    return {
      followers: followersData.length,
      following: followingData.length,
      total: totalRecords,
      processed: totalRecords
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = String(error);
    
    console.log(`[Worker ${workerId}] ❌ Job ${job.id} failed after ${executionTime}ms:`, error);

    await updateJobProgress(
      job.id,
      { followers: 0, following: 0 },
      { followers: 0, following: 0 },
      workerId,
      'failed',
      errorMessage
    );

    throw error;
  } finally {
    await cleanupTempFiles(job.file_paths, workerId);
  }
}

// Strategy selection
function getOptimalStrategy(totalRecords: number): 'monolithic' | 'batch_parallel' {
  return totalRecords < MONOLITHIC_THRESHOLD ? 'monolithic' : 'batch_parallel';
}

// Batch parallel import for > 1M records using WorkerPool
async function processBatchParallelImport(
  followersData: any[],
  followingData: any[],
  userId: string,
  workerId: string,
  jobId: string 
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  const totalRecords = followersData.length + followingData.length;
  
  console.log(`[Worker ${workerId}] 🚀 Starting batch parallel import for ${totalRecords.toLocaleString()} records`);

  try {
    // Step 1: Disable triggers globally
    console.log(`[Worker ${workerId}] 🔧 Step 1: Disabling triggers for batch import...`);
    // const disableResult = await disableTriggersForBatchImport(workerId);
    // if (!disableResult.success) {
    //   throw new Error(`Failed to disable triggers: ${disableResult.error}`);
    // }

    // Step 2: Process followers using WorkerPool
    if (followersData.length > 0) {
      console.log(`[Worker ${workerId}] 🔄 Step 2A: Processing ${followersData.length} followers with WorkerPool...`);
      
      // Enforce single-worker pool for followers
      const followersPool = new WorkerPool(1);
      const followersChunks = chunkArray(followersData, FOLLOWERS_CHUNK_SIZE);
      
      // Add progress tracking with Redis updates every 5 chunks
      let completedChunks = 0;
      let lastRedisUpdate = 0;
      const REDIS_UPDATE_INTERVAL = 1;
      
      followersPool.onTaskCompleted((result: WorkerPoolResult) => {
        completedChunks++;
        if (result.success) {
          // console.log(`[Worker ${workerId}] ✅ Followers chunk ${completedChunks}/${followersChunks.length} completed (${result.duration}ms)`);
        } else {
          console.log(`[Worker ${workerId}] ❌ Followers chunk ${completedChunks}/${followersChunks.length} failed: ${result.error}`);
        }
        
        // Update Redis every 5 chunks
        if (completedChunks - lastRedisUpdate >= REDIS_UPDATE_INTERVAL || completedChunks === followersChunks.length) {
          lastRedisUpdate = completedChunks;
          const processedFollowers = completedChunks * FOLLOWERS_CHUNK_SIZE;
          const progressPercent = Math.round((processedFollowers / totalRecords) * 100);
          
          // Update Redis stats async without blocking workers
          // const jobId = workerId.split('_')[0]; // Extract jobId from workerId
          const stats: RedisJobStats = {
            total: totalRecords,
            progress: progressPercent,
            followers: processedFollowers,
            following: 0,
            processed: processedFollowers
          };
          updateRedisJobStats(jobId, stats, workerId)
            .catch(err => console.log(`[Worker ${workerId}] ⚠️ Redis stats update failed: ${err.message}`));
        // }
        }
      });

      // Add all follower chunks to the pool
      followersChunks.forEach((chunk, index) => {
        followersPool.addTask({
          data: chunk,
          userId,
          dataType: 'followers',
          chunkIndex: index,
          workerId
        });
      });

      // Wait for all followers to complete
      const followersResults = await followersPool.waitForCompletion();
      const followersSummary = followersPool.getResultsSummary();
      
      // console.log(`[Worker ${workerId}] ✅ Step 2A completed: ${followersSummary.successfulChunks}/${followersChunks.length} chunks successful | ${followersSummary.totalProcessed} followers processed | Avg time: ${Math.round(followersSummary.averageChunkTime)}ms`);
      
      if (followersSummary.failedChunks > 0) {
        throw new Error(`${followersSummary.failedChunks} follower chunks failed: ${followersSummary.errors.join(', ')}`);
      }
    }

    // Step 3: Process following using WorkerPool  
    if (followingData.length > 0) {
      console.log(`[Worker ${workerId}] 🔄 Step 2B: Processing ${followingData.length} following with WorkerPool...`);
      
      const followingPool = new WorkerPool(BATCH_CONCURRENCY);
      const followingChunks = chunkArray(followingData, TARGETS_CHUNK_SIZE);
      
      // Add progress tracking with Redis updates every 5 chunks
      let completedChunks = 0;
      let lastRedisUpdate = 0;
      const REDIS_UPDATE_INTERVAL = 10;
      
      followingPool.onTaskCompleted((result: WorkerPoolResult) => {
        completedChunks++;
        if (result.success) {
          console.log(`[Worker ${workerId}] ✅ Following chunk ${completedChunks}/${followingChunks.length} completed (${result.duration}ms)`);
        } else {
          console.log(`[Worker ${workerId}] ❌ Following chunk ${completedChunks}/${followingChunks.length} failed: ${result.error}`);
        }
        
        // Update Redis every 5 chunks
        if (completedChunks - lastRedisUpdate >= REDIS_UPDATE_INTERVAL || completedChunks === followingChunks.length) {
          lastRedisUpdate = completedChunks;
          const processedFollowing = completedChunks * TARGETS_CHUNK_SIZE;
          const totalProcessed = followersData.length + processedFollowing;
          const progressPercent = Math.round((totalProcessed / totalRecords) * 100);
          
          // Update Redis stats async without blocking workers
          const jobId = workerId.split('_')[0]; // Extract jobId from workerId
          const stats: RedisJobStats = {
            total: totalRecords,
            progress: progressPercent,
            followers: followersData.length,
            following: processedFollowing,
            processed: totalProcessed
          };

          updateRedisJobStats(jobId, stats, workerId)
            .catch(err => console.log(`[Worker ${workerId}] ⚠️ Redis stats update failed: ${err.message}`));
        }
      });

      // Add all following chunks to the pool
      followingChunks.forEach((chunk, index) => {
        followingPool.addTask({
          data: chunk,
          userId,
          dataType: 'targets',
          chunkIndex: index,
          workerId
        });
      });

      // Wait for all following to complete
      const followingResults = await followingPool.waitForCompletion();
      const followingSummary = followingPool.getResultsSummary();
      
      // console.log(`[Worker ${workerId}] ✅ Step 2B completed: ${followingSummary.successfulChunks}/${followingChunks.length} chunks successful | ${followingSummary.totalProcessed} following processed | Avg time: ${Math.round(followingSummary.averageChunkTime)}ms`);
      
      if (followingSummary.failedChunks > 0) {
        throw new Error(`${followingSummary.failedChunks} following chunks failed: ${followingSummary.errors.join(', ')}`);
      }
    }

    // Step 4: Re-enable triggers
    // console.log(`[Worker ${workerId}] 🔧 Step 3: Re-enabling triggers after batch import...`);
    // const enableResult = await enableTriggersAfterBatchImport(workerId);
    // if (!enableResult.success) {
    //   console.log(`[Worker ${workerId}] ⚠️ Warning: Failed to re-enable triggers: ${enableResult.error}`);
    // }

    const executionTime = Date.now() - startTime;
    const throughput = Math.round(totalRecords / (executionTime / 1000));
    
    console.log(`[Worker ${workerId}] 🎉 Batch parallel import completed | Time: ${executionTime}ms | Throughput: ${throughput} records/sec`);
    
    return { success: true };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(`[Worker ${workerId}] ❌ Batch parallel import failed after ${executionTime}ms: ${errorMessage}`);
    
    // Try to re-enable triggers even on failure
    // try {
    //   await enableTriggersAfterBatchImport(workerId);
    // } catch (enableError) {
    //   console.log(`[Worker ${workerId}] ⚠️ Failed to re-enable triggers after error: ${enableError}`);
    // }
    
    return { success: false, error: errorMessage };
  }
}

// Helper functions for trigger management
async function disableTriggersForBatchImport(workerId: string): Promise<{ success: boolean; error?: string }> {
  const disableSQL = `
    SET statement_timeout TO '180s';
    SET work_mem TO '64MB';
    SET maintenance_work_mem TO '512MB';
    SET temp_buffers TO '32MB';
    
    ALTER TABLE sources_followers DISABLE TRIGGER ALL;
    ALTER TABLE sources_targets DISABLE TRIGGER ALL;
  `;
  
  const result = await executePostgresCommand(disableSQL, workerId, 90000);
  return result;
}

async function enableTriggersAfterBatchImport(workerId: string): Promise<{ success: boolean; error?: string }> {
  const enableSQL = `
    ALTER TABLE sources_followers ENABLE TRIGGER ALL;
    ALTER TABLE sources_targets ENABLE TRIGGER ALL;
  `;
  
  const result = await executePostgresCommand(enableSQL, workerId, 90000);
  return result;
}

// Utility function to chunk arrays
function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

export { 
  updateJobProgress,
  cleanupTempFiles,
  validateTwitterData,
  processTwitterFile,
  ensureSourceExists
};


export async function executePostgresCommand(sql: string, workerId: string, timeoutMs: number = 120000): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const env = {
      PGHOST: process.env.POSTGRES_HOST || 'localhost',
      PGPORT: process.env.POSTGRES_PORT || '5432',
      PGDATABASE: process.env.POSTGRES_DB || 'postgres',
      PGUSER: process.env.POSTGRES_USER || 'postgres',
      PGPASSWORD: process.env.POSTGRES_PASSWORD || 'postgres'
    };

    console.log(`[Worker ${workerId}] 🕒 Using adaptive timeout: ${timeoutMs}ms (${Math.round(timeoutMs/1000)}s)`);
    const psqlProcess = spawn('psql', ['-c', sql], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let resolved = false;
    let writeError: Error | null = null;

    // Timeout de sécurité
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.log(`[Worker ${workerId}] ⏰ psql command timeout after ${timeoutMs}ms`);
        psqlProcess.kill('SIGTERM');
        resolved = true;
        resolve({ success: false, error: 'Command timeout' });
      }
    }, timeoutMs);

    psqlProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    psqlProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    // Gestion des erreurs d'écriture (EPIPE)
    psqlProcess.stdin.on('error', (error) => {
      console.log(`[Worker ${workerId}] ❌ stdin write error:`, error.message);
      writeError = error;
      // Ne pas résoudre ici, attendre la fermeture du processus
    });

    // Écriture des données avec gestion d'erreur
    try {
      // Vérifier si le processus est encore vivant avant d'écrire
      if (!psqlProcess.killed) {
        psqlProcess.stdin.write('');
        psqlProcess.stdin.end();
      }
    } catch (error) {
      console.log(`[Worker ${workerId}] ❌ Error writing to stdin:`, error);
      writeError = error as Error;
    }

    psqlProcess.on('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);

      if (writeError) {
        console.log(`[Worker ${workerId}] ❌ psql failed due to write error: ${writeError.message}`);
        resolve({ success: false, error: `Write error: ${writeError.message}` });
        return;
      }

      if (code === 0) {
        // console.log(`[Worker ${workerId}] ✅ psql command executed successfully`);
        resolve({ success: true });
      } else {
        console.log(`[Worker ${workerId}] ❌ psql command failed with code ${code}`);
        console.log(`[Worker ${workerId}] stderr:`, stderr);
        console.log(`[Worker ${workerId}] stdout:`, stdout);
        resolve({ success: false, error: stderr || `Process exited with code ${code}` });
      }
    });

    psqlProcess.on('error', (error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      console.log(`[Worker ${workerId}] ❌ psql process error:`, error);
      resolve({ success: false, error: error.message });
    });
  });
}


async function processBatchDataViaPsql(
  data: any[],
  userId: string,
  workerId: string,
  dataType: 'followers' | 'targets',
  metrics: any
): Promise<number> {
  
  if (data.length === 0) {
    console.log(`[Worker ${workerId}] No ${dataType} data to process`);
    return 0;
  }

  console.log(`[Worker ${workerId}] 🚀 Starting ${dataType} processing via psql COPY | Total items: ${data.length}`);

  try {
    // Convert to CSV
    const { dataContent, relationsContent } = await convertTwitterDataToCSV(data, userId, dataType, workerId);
    
    // Import via psql COPY
    const result = await importCSVViaPsql(
      dataContent, 
      relationsContent, 
      dataType, 
      userId, 
      workerId, 
      true, // skipTriggerManagement=true
      true  // skipNodesImport=true
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }
    
    metrics.batchesProcessed++;
    metrics.successfulBatches++;
    
    // console.log(`[Worker ${workerId}] ✅ ${dataType} processing completed via psql COPY | Processed: ${result.processed} items`);
    
    return result.processed;
    
  } catch (error) {
    metrics.failedBatches++;
    console.log(`[Worker ${workerId}] ❌ ${dataType} processing failed via psql COPY:`, error);
    throw error;
  }

  
}

async function updateJobStats(jobId: string, stats: JobStats, workerId: string) {
  try {
    const updateData: any = {
      stats: stats,
      updated_at: new Date().toISOString()
    };

    await supabase
      .from('import_jobs')
      .update(updateData)
      .eq('id', jobId);

  } catch (error) {
    console.log(`[Worker ${workerId}] Error updating job stats:`, error);
  }
}