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
import { BigJobProcessor } from './bigJobProcessor';

const execAsync = promisify(exec);

// Charger les variables d'environnement
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const BATCH_SIZE = 500;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;
const LOCK_DIR = '/app/tmp/locks';
const UPLOADS_DIR = '/app/tmp/uploads';
const LOCK_TIMEOUT = 10 * 60 * 1000;

// S'assurer que les dossiers existent
if (!existsSync(LOCK_DIR)) {
  fs.mkdir(LOCK_DIR, { recursive: true });
}
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

// Système de verrous pour les fichiers
interface FileLockData {
  workerId: string;
  timestamp: number;
  directory?: string;
}

async function acquireFileLock(directory: string, workerId: string): Promise<boolean> {
  try {
    // Créer un nom de fichier de verrou basé sur le chemin du répertoire
    const directoryHash = Buffer.from(directory).toString('base64').replace(/[\/\+\=]/g, '_');
    const lockFile = `${LOCK_DIR}/dir_${directoryHash}.lock`;
    
    // Assurer que le répertoire des verrous existe
    if (!existsSync(LOCK_DIR)) {
      await fs.mkdir(LOCK_DIR, { recursive: true });
    }
    
    const lockData: FileLockData = {
      workerId,
      directory,
      timestamp: Date.now()
    };
    
    if (existsSync(lockFile)) {
      // Si le verrou existe déjà, vérifier s'il est périmé
      const existingLockContent = await fs.readFile(lockFile, 'utf-8');
      let existingLock: FileLockData;
      
      try {
        existingLock = JSON.parse(existingLockContent);
        const lockAge = Date.now() - existingLock.timestamp;
        
        // Si le verrou est périmé (plus de 30 secondes), on le remplace
        if (lockAge > LOCK_TIMEOUT) {
          await fs.writeFile(lockFile, JSON.stringify(lockData));
          console.log(
            'JobProcessor',
            'acquireFileLock',
            `Acquired stale lock for directory`,
            workerId,
            { directory, lockAge: `${lockAge}ms`, previousOwner: existingLock.workerId }
          );
          return true;
        }
        
        // Sinon, on ne peut pas acquérir le verrou
        console.log(
          'JobProcessor',
          'acquireFileLock',
          `Failed to acquire lock, already held by another worker`,
          workerId,
          { directory, owner: existingLock.workerId }
        );
        return false;
      } catch (err) {
        // Si le fichier de verrou est corrompu, on le remplace
        await fs.writeFile(lockFile, JSON.stringify(lockData));
        console.log(
          'JobProcessor',
          'acquireFileLock',
          `Acquired corrupted lock for directory`,
          workerId,
          { directory }
        );
        return true;
      }
    }
    
    // Créer un nouveau verrou
    await fs.writeFile(lockFile, JSON.stringify(lockData), { flag: 'wx' });
    console.log(
      'JobProcessor',
      'acquireFileLock',
      `Acquired new lock for directory`,
      workerId,
      { directory }
    );
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      // Une autre tentative d'écriture simultanée a réussi
      console.log(
        'JobProcessor',
        'acquireFileLock',
        `Race condition on lock acquisition`,
        workerId,
        { directory }
      );
      return false;
    }
    
    console.log(
      'JobProcessor',
      'acquireFileLock',
      `Error acquiring lock`,
      workerId,
      { directory },
      err as Error
    );
    return false;
  }
}

async function releaseFileLock(directory: string, workerId: string): Promise<boolean> {
  try {
    const directoryHash = Buffer.from(directory).toString('base64').replace(/[\/\+\=]/g, '_');
    const lockFile = `${LOCK_DIR}/dir_${directoryHash}.lock`;
    
    if (!existsSync(lockFile)) {
      console.log(
        'JobProcessor',
        'releaseFileLock',
        `Lock file doesn't exist`,
        workerId,
        { directory }
      );
      return true;
    }
    
    // Vérifier que le verrou appartient bien à ce worker
    const existingLockContent = await fs.readFile(lockFile, 'utf-8');
    let existingLock: FileLockData;
    
    try {
      existingLock = JSON.parse(existingLockContent);
      
      if (existingLock.workerId !== workerId) {
        console.log(
          'JobProcessor',
          'releaseFileLock',
          `Cannot release lock owned by another worker`,
          workerId,
          { directory, owner: existingLock.workerId }
        );
        return false;
      }
      
      // Supprimer le fichier de verrou
      await fs.unlink(lockFile);
      // console.log(
      //   'JobProcessor',
      //   'releaseFileLock',
      //   `Released lock for directory`,
      //   workerId,
      //   { directory }
      // );
      return true;
    } catch (err) {
      // Si le fichier de verrou est corrompu, on le supprime quand même
      try {
        await fs.unlink(lockFile);
        console.log(
          'JobProcessor',
          'releaseFileLock',
          `Released corrupted lock for directory`,
          workerId,
          { directory }
        );
        return true;
      } catch (unlinkErr) {
        console.log(
          'JobProcessor',
          'releaseFileLock',
          `Error removing corrupted lock file`,
          workerId,
          { directory },
          unlinkErr as Error
        );
        return false;
      }
    }
  } catch (err) {
    console.log(
      'JobProcessor',
      'releaseFileLock',
      `Error releasing lock`,
      workerId,
      { directory },
      err as Error
    );
    return false;
  }
}

async function cleanupTempFiles(filePaths: string[], workerId: string) {
  if (!filePaths || filePaths.length === 0) {
    return;
  }
  
  // Obtenir le répertoire parent à partir du premier chemin de fichier
  const userDir = dirname(filePaths[0]);
  
  // Essayer d'acquérir un verrou sur le répertoire
  // const lockAcquired = await acquireFileLock(userDir, workerId);
  
  // if (!lockAcquired) {
  //   console.log(
  //     'JobProcessor',
  //     'cleanupTempFiles',
  //     `Skipping cleanup, could not acquire directory lock`,
  //     workerId,
  //     { userDir, fileCount: filePaths.length }
  //   );
  //   return;
  // }
  
  try {
    // Supprimer chaque fichier individuellement
    for (const path of filePaths) {
      try {
        await fs.unlink(path);
      } catch (error) {
        // Journaliser l'erreur mais ne pas la propager
        const err = error as NodeJS.ErrnoException;
        console.log(
          'JobProcessor',
          'cleanupTempFiles',
          `Error deleting file`,
          workerId,
          { path, errorCode: err.code },
          err
        );
        
        // Si le fichier n'existe pas, ce n'est pas une erreur critique
        if (err.code !== 'ENOENT') {
          // Attendre un peu avant de continuer pour donner le temps aux autres processus
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  
    // Essayer de supprimer le répertoire
    try {
      // await fs.rmdir(userDir);
      await fs.rm(userDir, { recursive: true, force: true });

      // console.log(
      //   'JobProcessor',
      //   'cleanupTempFiles',
      //   `Successfully removed directory`,
      //   workerId,
      //   { userDir }
      // );
    } catch (error) {
      // Journaliser l'erreur mais ne pas la propager
      const err = error as NodeJS.ErrnoException;
      console.log(
        'JobProcessor',
        'cleanupTempFiles',
        `Error removing directory`,
        workerId,
        { userDir, errorCode: err.code },
        err
      );
    }
  } finally {
    // Toujours libérer le verrou à la fin
    // await releaseFileLock(userDir, workerId);
  }
}

async function acquireLock(jobId: string, workerId: string): Promise<boolean> {
  const lockFile = `${LOCK_DIR}/job_${jobId}.lock`;
  try {
    const lockData: LockData = {
      workerId,
      timestamp: Date.now()
    };
    
    // Check if lock exists and is stale
    if (existsSync(lockFile)) {
      const existingLock = JSON.parse(await fs.readFile(lockFile, 'utf-8'));
      const lockAge = Date.now() - existingLock.timestamp;
      
      if (lockAge > LOCK_TIMEOUT) {
        // Lock is stale, we can take it
        // console.log(`🔓 [Worker ${workerId}] Taking over stale lock for job ${jobId}`);
        await fs.writeFile(lockFile, JSON.stringify(lockData));
        return true;
      }
      return false;
    }

    // Create new lock
    await fs.writeFile(lockFile, JSON.stringify(lockData), { flag: 'wx' });
    return true;
  } catch (err) {
    return false;
  }
}

async function releaseLock(jobId: string, workerId: string) {
  const lockFile = `${LOCK_DIR}/job_${jobId}.lock`;
  try {
    const lockData = JSON.parse(await fs.readFile(lockFile, 'utf-8'));
    if (lockData.workerId === workerId) {
      await fs.unlink(lockFile);
      // console.log(`🔓 [Worker ${workerId}] Released lock for job ${jobId}`);
    }
  } catch (err) {
    // Ignore errors if file doesn't exist
  }
}

async function refreshLock(jobId: string, workerId: string): Promise<boolean> {
  const lockFile = `${LOCK_DIR}/job_${jobId}.lock`;
  try {
    const lockData = JSON.parse(await fs.readFile(lockFile, 'utf-8'));
    if (lockData.workerId === workerId) {
      lockData.timestamp = Date.now();
      await fs.writeFile(lockFile, JSON.stringify(lockData));
      return true;
    }
    return false;
  } catch (err) {
    return false;
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

export async function updateJobProgress(
  jobId: string, 
  processedItems: { followers: number; following: number }, 
  totalItems: { followers: number; following: number }, 
  workerId: string,
  status: 'processing' | 'completed' | 'failed' = 'processing',
  errorMessage?: string
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
    stats: {
      total: totalItems.followers + totalItems.following,
      progress: Math.round(((processedItems.followers + processedItems.following) / (totalItems.followers + totalItems.following)) * 100),
      followers: {
        processed: processedItems.followers,
        total: totalItems.followers
      },
      following: {
        processed: processedItems.following,
        total: totalItems.following
      },
      processed: processedItems.followers + processedItems.following
    }
  };

  if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  if (status === 'failed' && errorMessage) {
    updateData.error_log = errorMessage;
  }

  const { error } = await supabase
    .from('import_jobs')
    .update(updateData)
    .eq('id', jobId);

  if (error) {
    console.log(`❌ [Worker ${workerId}] Failed to update job progress:`, error);
  }
}

// Performance tracking interfaces
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
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        return fetch(input, {
          ...init,
          signal: AbortSignal.timeout(30000), // 30 second timeout
        });
      },
    }
  });

const supabaseAuth = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: "next-auth"
  }
});

// Validation des fichiers Twitter
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
    // console.log(`📖 [Worker ${workerId}] Reading file: ${filePath}`);
    const content = await readFile(filePath, 'utf-8');
    const type = filePath.toLowerCase().includes('following') ? 'following' : 'follower';
    
    // Valider le contenu
    const error = validateTwitterData(content, type);
    if (error) {
      throw new Error(error);
    }

    // Parser le JSON
    const prefix = `window.YTD.${type}.part0 = `;
    const jsonStr = content.substring(prefix.length);
    const data = JSON.parse(jsonStr);
    // console.log(`✅ [Worker ${workerId}] Successfully parsed ${data.length} items from ${filePath}`);
    return data;
  } catch (error) {
    console.log(`❌ [Worker ${workerId}] Error processing file ${filePath}:`, error);
    throw error;
  }
}

async function ensureSourceExists(userId: string, workerId: string) {
  // Vérifier si la source existe déjà
  const { data: source } = await supabase
    .from('sources')
    .select('id')
    .eq('id', userId)
    .single();

  // Si la source n'existe pas, la créer
  if (!source) {
    console.log(`📝 [Worker ${workerId}] Creating source for user ${userId}`);
    const { error } = await supabase
      .from('sources')
      .insert({ id: userId });

    if (error) {
      console.log(`❌ [Worker ${workerId}] Error creating source:`, error);
      throw error;
    }
  }
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
  const metrics = {
    batchesProcessed: 0,
    successfulBatches: 0,
    failedBatches: 0,
    retries: 0,
    processedItemsFollowers: 0,
    processedItemsFollowing: 0,
  };

  let followersData: any[] = [];
  let followingData: any[] = [];

  try {
    if (!await acquireLock(job.id, workerId)) {
      console.log(`[Worker ${workerId}] Job ${job.id} already locked`);
      return {
        followers: 0,
        following: 0,
        total: 0,
        processed: 0,
      };
    }

    await updateJobProgress(job.id, {followers: 0, following: 0}, {followers: 0, following: 0}, workerId, 'processing');

    await ensureSourceExists(job.user_id, workerId);
    console.log(`[Worker ${workerId}] Starting job ${job.id} for user ${job.user_id}`);

    // Traiter les fichiers
    for (const filePath of job.file_paths) {
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
    }
    
    let followersFilePath = '';
    let followingFilePath = '';
    
    for (const filePath of job.file_paths) {
      if (filePath.toLowerCase().includes('follower')) {
        followersFilePath = filePath;
      } else if (filePath.toLowerCase().includes('following')) {
        followingFilePath = filePath;
      }
    }
    
    try {
      if (followersFilePath) {
        followersData = await processTwitterFile(followersFilePath, workerId);
        console.log(`[Worker ${workerId}] Parsed ${followersData.length} followers`);
      }
      
      if (followingFilePath) {
        followingData = await processTwitterFile(followingFilePath, workerId);
        console.log(`[Worker ${workerId}] Parsed ${followingData.length} following`);
      }
    } catch (error) {
      console.log(`[Worker ${workerId}] Failed to parse Twitter files: ${error}`);
      throw new Error(`Error processing Twitter files: ${error}`);
    }

    // 🚀 DECISION LOGIC: Use BigJobProcessor for large volumes
    const totalRecords = followersData.length + followingData.length;
    const shouldUseBigProcessor = BigJobProcessor.shouldUseBigProcessor(
      followersData.length, 
      followingData.length
    );

    console.log(`[Worker ${workerId}] Processing decision`, {
      jobId: job.id,
      followersCount: followersData.length,
      followingCount: followingData.length,
      totalRecords,
      processingMode: shouldUseBigProcessor ? 'BIG_JOB' : 'NORMAL',
      threshold: '100k records'
    });

    if (shouldUseBigProcessor) {
      // 🔥 BIG JOB MODE: Use parallel chunked processing
      console.log(`[Worker ${workerId}] 🚀 Switching to BIG JOB mode for ${totalRecords} records`);
      
      const jobManager = new JobManager();
      const bigJobProcessor = new BigJobProcessor(jobManager, workerId);
      
      const bigJobResult = await bigJobProcessor.processBigJob(
        job.id,
        job.user_id,
        followersData,
        followingData
      );

      if (!bigJobResult.success) {
        throw new Error(`Big job processing failed: ${bigJobResult.error}`);
      }

      // Mark job as completed
      await updateJobProgress(
        job.id,
        { followers: followersData.length, following: followingData.length },
        { followers: followersData.length, following: followingData.length },
        workerId,
        'completed'
      );

      const totalTime = Date.now() - startTime;
      console.log(`[Worker ${workerId}] 🎉 BIG JOB completed`, {
        jobId: job.id,
        totalTime: `${totalTime}ms`,
        totalProcessed: bigJobResult.totalProcessed,
        chunksCompleted: bigJobResult.chunksCompleted,
        parallelWorkers: bigJobResult.parallelWorkers,
        throughput: `${Math.round(bigJobResult.totalProcessed / (totalTime / 1000))} records/sec`
      });

      return {
        followers: followersData.length,
        following: followingData.length,
        total: bigJobResult.totalProcessed,
        processed: bigJobResult.totalProcessed
      };

    } else {
      // 📦 NORMAL MODE: Use current optimized processing
      console.log(`[Worker ${workerId}] 📦 Using NORMAL mode for ${totalRecords} records`);

      // Calculate total items for progress tracking
      const totalItems = {
        followers: followersData.length,
        following: followingData.length
      };
      const currentProgress = {
        followers: 0,
        following: 0,
      };

      // Process followers and targets in PARALLEL instead of sequential
      const [followersProcessed, targetsProcessed] = await Promise.all([
        processBatchDataViaPsql(
          followersData,
          job.user_id,
          workerId,
          'followers',
          metrics
        ),
        processBatchDataViaPsql(
          followingData,
          job.user_id,
          workerId,
          'targets', 
          metrics
        )
      ]);

      metrics.processedItemsFollowers = followersProcessed;
      metrics.processedItemsFollowing = targetsProcessed;

      // Mark job as completed
      await updateJobProgress(
        job.id,
        { followers: followersData.length, following: followingData.length },
        totalItems,
        workerId,
        'completed'
      );

      const totalTime = Date.now() - startTime;
      console.log(`[Worker ${workerId}] Job ${job.id} completed | Total time: ${totalTime}ms | Followers: ${metrics.processedItemsFollowers} | Following: ${metrics.processedItemsFollowing} | Failed batches: ${metrics.failedBatches} | Retries: ${metrics.retries}`);
      
      return {
        followers: metrics.processedItemsFollowers,
        following: metrics.processedItemsFollowing,
        total: metrics.processedItemsFollowers + metrics.processedItemsFollowing,
        processed: metrics.processedItemsFollowers + metrics.processedItemsFollowing
      };
    }
    
  } catch (error) {
    console.log(`[Worker ${workerId}] Job ${job.id} failed: ${error}`);

    await updateJobProgress(
      job.id,
      { followers: metrics.processedItemsFollowers, following: metrics.processedItemsFollowing },
      { followers: followersData?.length || 0, following: followingData?.length || 0 },
      workerId,
      'failed',
      String(error)
    );
    
    // Retourner les statistiques même en cas d'erreur
    throw error;
  } finally {
    await releaseLock(job.id, workerId);
    
    // Cleanup temp files
    if (job.file_paths && job.file_paths.length > 0) {
      await cleanupTempFiles(job.file_paths, workerId);
    }
  }
}

// /**
//  * Update social mappings after successful import
//  */
// async function updateSocialMappingsAfterImport(followingData: any[], workerId: string): Promise<void> {
//   if (!followingData || followingData.length === 0) {
//     console.log(`[Worker ${workerId}] No following data to update social mappings`);
//     return;
//   }

//   try {
//     console.log(`[Worker ${workerId}] 🔄 Starting social mappings update for ${followingData.length} following records`);
    
//     // Extraire les twitter IDs depuis les données following
//     const twitterIds = followingData.map(item => item.following?.accountId).filter(Boolean);
    
//     if (twitterIds.length === 0) {
//       console.log(`[Worker ${workerId}] No valid twitter IDs found in following data`);
//       return;
//     }

//     // Utiliser le service de mapping social
//     const socialMappingService = new SocialMappingService();
//     const result = await socialMappingService.batchUpdateSourcesTargets(twitterIds);
    
//     console.log(`[Worker ${workerId}] ✅ Social mappings update completed:`, {
//       processed: result.processed,
//       updated: result.updated,
//       errors: result.errors,
//       duration: `${result.duration}ms`
//     });

//   } catch (error) {
//     console.log(`[Worker ${workerId}] ⚠️ Social mappings update failed (non-critical):`, error);
//     // Ne pas faire échouer le job principal si les mappings échouent
//   }
// }

// CSV conversion and psql import functions
export async function convertTwitterDataToCSV(
  data: any[],
  userId: string,
  dataType: 'followers' | 'targets',
  workerId: string
): Promise<{ dataContent: string; relationsContent: string }> {
  try {
    // Prepare data for CSV export
    const isFollowers = dataType === 'followers';
    const itemKey = isFollowers ? 'follower' : 'following';
    
    // Create data CSV content (for sources_followers or sources_targets main data)
    const dataRows = data.map(item => {
      const twitterId = item[itemKey].accountId;
      return `"${twitterId}"`;
    }).join('\n');
    
    const dataHeader = 'twitter_id';
    const dataContent = `${dataHeader}\n${dataRows}`;
    
    // Create relations CSV content (for the relationship tables)
    const relationsRows = data.map(item => {
      const twitterId = item[itemKey].accountId;
      if (isFollowers) {
        return `"${userId}","${twitterId}"`;
      } else {
        return `"${userId}","${twitterId}"`;
      }
    }).join('\n');
    
    const relationsHeader = isFollowers 
      ? 'source_id,follower_id' 
      : 'source_id,target_twitter_id';
    const relationsContent = `${relationsHeader}\n${relationsRows}`;
    
    console.log(`[Worker ${workerId}] ✅ CSV content created: ${data.length} data rows, ${data.length} relation rows`);
    
    return { dataContent, relationsContent };
    
  } catch (error) {
    console.log(`[Worker ${workerId}] ❌ Error creating CSV content:`, error);
    throw error;
  }
}

export async function importCSVViaPsql(
  dataContent: string,
  relationsContent: string,
  dataType: 'followers' | 'targets',
  userId: string,
  workerId: string,
  skipTriggerManagement: boolean = false
): Promise<{ success: boolean; processed: number; error?: string }> {
  const maxRetries = 3;
  const baseDelayMs = 1000; // 1 second base delay
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await importCSVViaPsqlAttempt(dataContent, relationsContent, dataType, userId, workerId, skipTriggerManagement);
      
      if (result.success || attempt === maxRetries) {
        return result;
      }
      
      // Check if error is retryable (deadlock or timeout)
      const isRetryable = result.error && (
        result.error.includes('deadlock detected') ||
        result.error.includes('Command timeout') ||
        result.error.includes('could not serialize access')
      );
      
      if (!isRetryable) {
        return result; // Non-retryable error, fail immediately
      }
      
      // Calculate exponential backoff delay
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Worker ${workerId}] 🔄 Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms delay (${result.error?.substring(0, 100)}...)`);
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delayMs));
      
    } catch (error) {
      console.log(`[Worker ${workerId}] ❌ Unexpected error in retry attempt ${attempt}:`, error);
      if (attempt === maxRetries) {
        return { success: false, processed: 0, error: `Max retries exceeded: ${error}` };
      }
    }
  }
  
  return { success: false, processed: 0, error: 'Max retries exceeded' };
}

async function importCSVViaPsqlAttempt(
  dataContent: string,
  relationsContent: string,
  dataType: 'followers' | 'targets',
  userId: string,
  workerId: string,
  skipTriggerManagement: boolean = false
): Promise<{ success: boolean; processed: number; error?: string }> {
  const startTime = Date.now();
  const isFollowers = dataType === 'followers';
  
  // Parse data to get counts
  const dataLines = dataContent.trim().split('\n');
  const relationsLines = relationsContent.trim().split('\n');
  const dataCount = Math.max(0, dataLines.length - 1); // Exclude header
  const relationsCount = Math.max(0, relationsLines.length - 1); // Exclude header

  console.log(`[Worker ${workerId}] 🚀 ${skipTriggerManagement ? 'Simple' : 'Optimized'} bulk import for ${dataType} | Base records: ${dataCount} | Relations: ${relationsCount}...`);
  
  // Calculate timeout based on data volume - increased base timeout for trigger management overhead
  const timeoutValue = Math.max(180, Math.min(1200, 180 + Math.floor((dataCount + relationsCount) / 1000) * 30));
  console.log(`[Worker ${workerId}] ⏱️ Using timeout: ${timeoutValue}s for ${dataCount + relationsCount} total records`);

  const baseTableName = isFollowers ? 'followers' : 'targets';
  const relationTableName = isFollowers ? 'sources_followers' : 'sources_targets';
  const baseTempTable = `temp_${baseTableName}_${Date.now()}`;
  const relationTempTable = `temp_${relationTableName}_${Date.now()}`;
  const relationTempColumns = isFollowers ? 'source_id UUID, follower_id TEXT' : 'source_id UUID, target_twitter_id TEXT';
  const conflictColumns = isFollowers ? 'source_id, follower_id' : 'source_id, target_twitter_id';

  try {
    // STEP 1: Import base records (triggers managed by BigJobProcessor if skipTriggerManagement=true)
    const baseImportSql = `
      BEGIN;
      
      -- Set statement timeout for this transaction
      SET statement_timeout TO '${timeoutValue}s';
      
      -- Create temporary table
      CREATE TEMP TABLE ${baseTempTable} (
        twitter_id TEXT
      );
      
      -- Import base records data from stdin
      COPY ${baseTempTable} FROM STDIN WITH (FORMAT csv, HEADER true, DELIMITER ',');
      
      -- Import base records into main table with conflict resolution
      INSERT INTO ${baseTableName} (twitter_id)
      SELECT DISTINCT twitter_id 
      FROM ${baseTempTable}
      ON CONFLICT (twitter_id) DO NOTHING;
      
      -- Drop temp table
      DROP TABLE ${baseTempTable};
      
      COMMIT;
    `;

    // Execute base records import
    console.log(`[Worker ${workerId}] 🚀 Step 1: Importing base records into ${baseTableName} table...`);
    const baseResult = await executePostgresCommandWithStdin(baseImportSql, dataContent, workerId);
    if (!baseResult.success) {
      throw new Error(`Base records import failed: ${baseResult.error}`);
    }
    console.log(`[Worker ${workerId}] ✅ Step 1 completed: Base records imported into ${baseTableName}`);

    // STEP 2: Import relations (triggers managed by BigJobProcessor if skipTriggerManagement=true)
    const relationsImportSql = `
      BEGIN;
      
      -- Set statement timeout for this transaction
      SET statement_timeout TO '${timeoutValue}s';
      
      -- Create temporary table for relations
      CREATE TEMP TABLE ${relationTempTable} (
        ${relationTempColumns}
      );
      
      -- Import relations data from stdin
      COPY ${relationTempTable} FROM STDIN WITH (FORMAT csv, HEADER true, DELIMITER ',');
      
      -- Import relations into main table with conflict resolution
      INSERT INTO ${relationTableName} (${conflictColumns})
      SELECT ${conflictColumns}
      FROM ${relationTempTable}
      ON CONFLICT (${conflictColumns}) DO NOTHING;
      
      -- Drop temp table
      DROP TABLE ${relationTempTable};
      
      COMMIT;
    `;

    console.log(`[Worker ${workerId}] 🚀 Step 2: Importing relationships into ${relationTableName}...`);
    const relationResult = await executePostgresCommandWithStdin(relationsImportSql, relationsContent, workerId);
    if (!relationResult.success) {
      throw new Error(`Relationships import failed: ${relationResult.error}`);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${workerId}] ✅ Step 2 completed: Relationships imported into ${relationTableName}`);
    console.log(`[Worker ${workerId}] 🎉 ${skipTriggerManagement ? 'Simple' : 'Optimized'} bulk import completed for ${dataType} | Base records: ${dataCount} | Relations: ${relationsCount} | Time: ${executionTime}ms`);
    
    return { success: true, processed: relationsCount };
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.log(`[Worker ${workerId}] ❌ ${skipTriggerManagement ? 'Simple' : 'Optimized'} bulk import failed for ${dataType} | Time: ${executionTime}ms | Error: ${error}`);
    
    // Clean up CSV files
    try {
      const timestamp = Date.now();
      const dataFilePath = `/tmp/${dataType}_data_${userId}_${timestamp}.csv`;
      const relationsFilePath = `/tmp/${dataType}_relations_${userId}_${timestamp}.csv`;
      await fs.unlink(dataFilePath).catch(() => {});
      await fs.unlink(relationsFilePath).catch(() => {});
      console.log(`[Worker ${workerId}] 🧹 Cleaned up CSV files: ${dataFilePath}, ${relationsFilePath}`);
    } catch (cleanupError) {
      console.log(`[Worker ${workerId}] ⚠️ Failed to cleanup CSV files:`, cleanupError);
    }
    
    return { success: false, processed: 0, error: String(error) };
  }
}

export async function executePostgresCommand(sql: string, workerId: string, timeoutMs: number = 120000): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const env = {
      PGHOST: process.env.POSTGRES_HOST || 'localhost',
      PGPORT: process.env.POSTGRES_PORT || '5432',
      PGDATABASE: process.env.POSTGRES_DB || 'postgres',
      PGUSER: process.env.POSTGRES_USER || 'postgres',
      PGPASSWORD: process.env.POSTGRES_PASSWORD || 'postgres'
    };

    const psqlProcess = spawn('psql', ['-c', sql], {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // Set timeout for the psql process
    const timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        psqlProcess.kill('SIGTERM');
        console.log(`[Worker ${workerId}] ⏰ psql command timeout after ${timeoutMs}ms`);
        resolve({ success: false, error: 'Command timeout' });
      }
    }, timeoutMs);

    psqlProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    psqlProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    psqlProcess.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
        if (code === 0) {
          console.log(`[Worker ${workerId}] ✅ psql command executed successfully`);
          resolve({ success: true });
        } else {
          console.log(`[Worker ${workerId}] ❌ psql command failed with code ${code}`);
          console.log(`[Worker ${workerId}] stderr:`, stderr);
          console.log(`[Worker ${workerId}] stdout:`, stdout);
          resolve({ success: false, error: stderr || `Process exited with code ${code}` });
        }
      }
    });

    psqlProcess.on('error', (error) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(timeoutId);
        console.log(`[Worker ${workerId}] ❌ psql process error:`, error);
        resolve({ success: false, error: error.message });
      }
    });
  });
}

async function executePostgresCommandWithStdin(sql: string, stdinData: string, workerId: string): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const env = {
      PGHOST: process.env.POSTGRES_HOST || 'localhost',
      PGPORT: process.env.POSTGRES_PORT || '5432',
      PGDATABASE: process.env.POSTGRES_DB || 'postgres',
      PGUSER: process.env.POSTGRES_USER || 'postgres',
      PGPASSWORD: process.env.POSTGRES_PASSWORD || 'postgres'
    };

    // Augmenter le timeout pour les gros volumes
    const timeoutMs = 120000; // 2 minutes
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
        psqlProcess.stdin.write(stdinData);
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
        console.log(`[Worker ${workerId}] ✅ psql command executed successfully`);
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
      true // skipTriggerManagement=true
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Import failed');
    }
    
    metrics.batchesProcessed++;
    metrics.successfulBatches++;
    
    console.log(`[Worker ${workerId}] ✅ ${dataType} processing completed via psql COPY | Processed: ${result.processed} items`);
    
    return result.processed;
    
  } catch (error) {
    metrics.failedBatches++;
    console.log(`[Worker ${workerId}] ❌ ${dataType} processing failed via psql COPY:`, error);
    throw error;
  }

  
}