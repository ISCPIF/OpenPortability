// worker/src/jobProcessor.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFile, unlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { createWriteStream, existsSync, promises as fs } from 'fs';
import { sleep } from './utils';
import logger from './log_utils';

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
      await fs.rmdir(userDir);
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

async function updateJobProgress(
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

export async function processJob(job: ImportJob, workerId: string) {
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
      return;
    }

    await updateJobProgress(job.id, {followers: 0, following: 0}, {followers: 0, following: 0}, workerId, 'processing');

    await ensureSourceExists(job.user_id, workerId);
    console.log(`[Worker ${workerId}] Starting job ${job.id} for user ${job.user_id}`);

    // Validate files exist
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

    // Calculate total items for progress tracking
    const totalItems = {
      followers: followersData.length,
      following: followingData.length
    };
    const currentProgress = {
      followers: 0,
      following: 0,
    };

    // Update job status to processing
    // await updateJobProgress(job.id, currentProgress, totalItems, workerId, 'processing');

    // Process followers
    if (followersData.length > 0) {
      const processedFollowers = await processBatchData(
        followersData,
        job.user_id,
        workerId,
        'followers',
        batch_insert_followers,
        metrics
      );
      
      currentProgress.followers = processedFollowers;
      metrics.processedItemsFollowers = processedFollowers;
      
      // await updateJobProgress(job.id, currentProgress, totalItems, workerId, 'processing');
    }

    // Process following
    if (followingData.length > 0) {
      const processedFollowing = await processBatchData(
        followingData,
        job.user_id,
        workerId,
        'following',
        batch_insert_targets,
        metrics
      );
      
      currentProgress.following = processedFollowing;
      metrics.processedItemsFollowing = processedFollowing;
      
      // await updateJobProgress(job.id, currentProgress, totalItems, workerId, 'processing');
    }

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
  } finally {
    await cleanupTempFiles(job.file_paths, workerId);
    const { error: hasBoardError } = await supabaseAuth
    .from('users')
    .update({ has_onboarded: true })
    .eq('id', job.user_id);
    if (hasBoardError) {
      console.log(`❌ [Worker ${workerId}] Error updating has_onboarded:`, hasBoardError);
    }
    await releaseLock(job.id, workerId);

  }
}

// Generic batch processing function
async function processBatchData(
  data: any[],
  userId: string,
  workerId: string,
  dataType: 'followers' | 'following',
  batchInsertFn: Function,
  metrics: any
): Promise<number> {
  const isFollowers = dataType === 'followers';
  const itemKey = isFollowers ? 'follower' : 'following';
  
  // Validation
  if (!data || !Array.isArray(data)) {
    throw new Error(`${dataType} data must be an array`);
  }

  if (data.length > 0 && !data[0]?.[itemKey]?.accountId) {
    throw new Error(`Invalid ${dataType} data structure: missing accountId`);
  }

  // Create source if it doesn't exist
  // await ensureSourceExists(userId, workerId);

  // Configuration adaptée selon le type
  let CHUNK_SIZE = isFollowers ? 500 : 500;
  const MIN_CHUNK_SIZE = 20;
  const MAX_RETRIES = 3;
  const BASE_DELAY = 500;
  
  let processedItems = 0;
  const timeoutErrors: any[] = [];
  const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

  for (let i = 0; i < data.length;) {
    const batch = data.slice(i, i + CHUNK_SIZE);
    let retryCount = 0;
    let successfulProcessing = false;

    while (retryCount < MAX_RETRIES && !successfulProcessing) {
      try {
        // Prepare data based on type
        const dataToInsert = batch.map((item: any) => ({
          twitter_id: item[itemKey].accountId,
        }));

        const relationsToInsert = batch.map((item: any) => ({
          source_id: userId,
          ...(isFollowers 
            ? { follower_id: item[itemKey].accountId }
            : { target_twitter_id: item[itemKey].accountId }
          ),
        }));

        const startTime = Date.now();
        const currentChunk = Math.floor(i / CHUNK_SIZE) + 1;
        
        // Execute batch insert
        const { error: batchError } = await batchInsertFn(
          supabase,
          dataToInsert,
          relationsToInsert
        );
        
        const executionTime = Date.now() - startTime;

        if (batchError) {
          console.log(`[Worker ${workerId}] ${dataType} batch failed | Chunk: ${currentChunk}/${totalChunks} | Size: ${batch.length} | Error: ${batchError.message} | Code: ${batchError.code}`);
          throw batchError;
        }

        // Success
        successfulProcessing = true;
        i += CHUNK_SIZE;
        processedItems += batch.length;
        metrics.batchesProcessed++;
        metrics.successfulBatches++;
        
        // Dynamic chunk size adjustment (silent)
        // if (executionTime < 10000 && CHUNK_SIZE < 150) {
        //   CHUNK_SIZE = Math.min(150, Math.floor(CHUNK_SIZE * 1.2));
        // }
        
      } catch (error) {
        retryCount++;
        metrics.retries++;
        
        const errorMsg = String(error);
        const isTimeoutError = errorMsg.includes('canceling statement due to statement timeout') || 
                              errorMsg.includes('57014') ||
                              errorMsg.includes('timeout');
        
        if (isTimeoutError) {
          timeoutErrors.push({ chunkSize: batch.length, error: errorMsg });
          CHUNK_SIZE = Math.max(MIN_CHUNK_SIZE, Math.floor(CHUNK_SIZE / 2));
          console.log(`[Worker ${workerId}] ${dataType} timeout | Chunk: ${Math.floor(i / CHUNK_SIZE) + 1}/${totalChunks} | Reducing size to ${CHUNK_SIZE}`);
          
          if (CHUNK_SIZE < batch.length) {
            break; // Retry with smaller chunk
          }
        }
        
        if (retryCount === MAX_RETRIES) {
          console.log(`[Worker ${workerId}] ${dataType} batch failed after ${MAX_RETRIES} retries | Chunk size: ${batch.length} | Error: ${errorMsg.substring(0, 100)}`);
          metrics.failedBatches++;
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * BASE_DELAY));
      }
    }
    
    // Delay between batches
    await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
  }

  if (timeoutErrors.length > 0) {
    console.log(`[Worker ${workerId}] ${dataType} completed with ${timeoutErrors.length} timeout adjustments | Final chunk size: ${CHUNK_SIZE}`);
  }

  // console.log(`[Worker ${workerId}] Successfully processed ${processedItems} ${dataType}`);
  return processedItems;
}

// Keep the original batch insert functions as they are
async function batch_insert_followers(
  supabase: any,
  followersData: any[],
  relationsData: any[]
): Promise<{ error: any }> {
  try {
    const { error } = await supabase.rpc('batch_insert_followers', {
      followers_data: followersData,
      relations_data: relationsData,
      batch_size: 500,  // Taille de lot plus petite
      statement_timeout_ms: 30000  // Timeout plus long (30 secondes)
    });
    return { error };
  } catch (error) {
    return { error };
  }
}

async function batch_insert_targets(
  supabase: any,
  targetsData: any[],
  relationsData: any[]
): Promise<{ error: any }> {
  try {
    const { error } = await supabase.rpc('batch_insert_targets', {
      targets_data: targetsData,
      relations_data: relationsData,
      batch_size: 500,
      statement_timeout_ms: 30000
    });
    return { error };
  } catch (error) {
    return { error };
  }
}