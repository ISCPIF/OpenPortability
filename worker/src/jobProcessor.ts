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
const LOCK_TIMEOUT = 5 * 60 * 1000;

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
      console.log(
        'JobProcessor',
        'releaseFileLock',
        `Released lock for directory`,
        workerId,
        { directory }
      );
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
  const lockAcquired = await acquireFileLock(userDir, workerId);
  
  if (!lockAcquired) {
    console.log(
      'JobProcessor',
      'cleanupTempFiles',
      `Skipping cleanup, could not acquire directory lock`,
      workerId,
      { userDir, fileCount: filePaths.length }
    );
    return;
  }
  
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
      console.log(
        'JobProcessor',
        'cleanupTempFiles',
        `Successfully removed directory`,
        workerId,
        { userDir }
      );
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
    await releaseFileLock(userDir, workerId);
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
        console.log(`🔓 [Worker ${workerId}] Taking over stale lock for job ${jobId}`);
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
      console.log(`🔓 [Worker ${workerId}] Released lock for job ${jobId}`);
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
    console.log(`📖 [Worker ${workerId}] Reading file: ${filePath}`);
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
    console.log(`✅ [Worker ${workerId}] Successfully parsed ${data.length} items from ${filePath}`);
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
      console.log(
        'JobProcessor',
        'processJob',
        'Job already locked',
        workerId,
        { jobId: job.id }
      );
      return;
    }

    console.log(
      'JobProcessor',
      'processJob',
      'Starting job processing',
      workerId,
      { jobId: job.id, userId: job.user_id }
    );

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
        console.log(`✅ [Worker ${workerId}] Processed ${followersData.length} followers`);
      }
      
      if (followingFilePath) {
        followingData = await processTwitterFile(followingFilePath, workerId);
        console.log(`✅ [Worker ${workerId}] Processed ${followingData.length} following`);
      }
    } catch (error) {
      console.log(
        'JobProcessor',
        'processJob',
        'Failed to parse Twitter file',
        workerId,
        { followersFilePath, followingFilePath },
        error
      );
      throw new Error(`Error processing Twitter files: ${error}`);
    }

    console.log(
      'JobProcessor',
      'processJob',
      'Files parsed successfully',
      workerId,
      {
        jobId: job.id,
        followersCount: followersData.length,
        followingCount: followingData.length,
      }
    );

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
    await updateJobProgress(
      job.id,
      currentProgress,
      totalItems,
      workerId,
      'processing'
    );

    // Process followers
    if (followersData.length > 0) {
      await processFollowers(followersData, job.user_id, workerId);
      currentProgress.followers = followersData.length;
      
      // Update progress after followers are processed
      await updateJobProgress(
        job.id,
        currentProgress,
        totalItems,
        workerId,
        'processing'
      );
    }

    // Process following
    if (followingData.length > 0) {
      // Réduire la taille initiale des chunks pour éviter les timeouts
      let CHUNK_SIZE = 75; // Réduit de 150 à 75 (plus petit que pour followers)
      const MIN_CHUNK_SIZE = 20; // Taille minimale de chunk
      const MAX_RETRIES = 3;
      const BASE_DELAY = 500;
      
      // Tableau pour suivre les erreurs de timeout
      const timeoutErrors: any[] = [];

      for (let i = 0; i < followingData.length;) {
        const batch = followingData.slice(i, i + CHUNK_SIZE);
        metrics.batchesProcessed++;
        let retryCount = 0;
        let successfulProcessing = false;

        while (retryCount < MAX_RETRIES && !successfulProcessing) {
          try {
            // Prepare data for batch insertion
            const targetsToInsert = batch.map((item: any) => ({
              twitter_id: item.following.accountId,
            }));

            const relationsToInsert = batch.map((item: any) => ({
              source_id: job.user_id,
              target_twitter_id: item.following.accountId,
            }));

            // Mesurer le temps d'exécution de la requête
            const startTime = Date.now();
            
            // Try batch insert
            const { error: batchError } = await batch_insert_targets(
              supabase,
              targetsToInsert,
              relationsToInsert
            );
            
            const executionTime = Date.now() - startTime;

            if (batchError) {
              throw batchError;
            }

            // Log success
            console.log(
              'JobProcessor',
              'processJob',
              `Processed following chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(followingData.length/CHUNK_SIZE)}`,
              workerId,
              { 
                userId: job.user_id, 
                chunkSize: batch.length, 
                executionTime: `${executionTime}ms`,
                remainingChunks: Math.ceil((followingData.length - (i + batch.length)) / CHUNK_SIZE)
              }
            );
            
            successfulProcessing = true;
            
            // Avancer au prochain batch seulement en cas de succès
            i += CHUNK_SIZE;
            metrics.successfulBatches++;
            metrics.processedItemsFollowing += batch.length;
            
            // Ajuster dynamiquement la taille du chunk en fonction du temps d'exécution
            if (executionTime < 10000 && CHUNK_SIZE < 150) { // Moins de 10 secondes
              CHUNK_SIZE = Math.min(150, Math.floor(CHUNK_SIZE * 1.2));
              console.log(
                'JobProcessor',
                'processJob',
                `Fast execution detected, increasing chunk size to ${CHUNK_SIZE}`,
                workerId,
                { userId: job.user_id, executionTime: `${executionTime}ms`, newSize: CHUNK_SIZE }
              );
            }
            
          } catch (error) {
            retryCount++;
            metrics.retries++;
            
            const errorMsg = String(error);
            const isTimeoutError = errorMsg.includes('canceling statement due to statement timeout') || 
                                  errorMsg.includes('57014') ||
                                  errorMsg.includes('timeout');
            
            if (isTimeoutError) {
              timeoutErrors.push({ chunkSize: batch.length, error: errorMsg });
              
              // Réduire la taille du batch en cas de timeout
              CHUNK_SIZE = Math.max(MIN_CHUNK_SIZE, Math.floor(CHUNK_SIZE / 2));
              
              console.log(
                'JobProcessor',
                'processJob',
                `SQL timeout detected, reducing batch size to ${CHUNK_SIZE}`,
                workerId,
                { userId: job.user_id, originalSize: batch.length, newSize: CHUNK_SIZE }
              );
              
              // Si on a réduit la taille, on réessaie avec un batch plus petit
              if (CHUNK_SIZE < batch.length) {
                break; // Sortir de la boucle de retry pour réessayer avec un batch plus petit
              }
            }
            
            console.log(
              'JobProcessor',
              'processJob',
              `Batch processing failed (attempt ${retryCount}/${MAX_RETRIES})`,
              workerId,
              { 
                userId: job.user_id,
                batchSize: batch.length,
                batchIndex: i,
                retryCount,
                isTimeout: isTimeoutError,
                errorMessage: errorMsg.substring(0, 200) // Limiter la taille du message d'erreur
              },
              error as Error
            );

            if (retryCount === MAX_RETRIES) {
              metrics.failedBatches++;
              throw error;
            }
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * BASE_DELAY));
          }
        }
        
        // Mettre à jour la progression des following
        currentProgress.following = Math.min(followingData.length, currentProgress.following + batch.length);
        
        // Envoyer la mise à jour avec les deux progressions
        await updateJobProgress(
          job.id,
          currentProgress,
          totalItems,
          workerId,
          'processing'
        );
        
        // Add delay between batches
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
      }

      if (timeoutErrors.length > 0) {
        console.log(
          'JobProcessor',
          'processJob',
          `Completed following with ${timeoutErrors.length} timeout adjustments`,
          workerId,
          { 
            userId: job.user_id,
            timeoutErrors: timeoutErrors.slice(0, 3),
            finalChunkSize: CHUNK_SIZE
          }
        );
      }

      console.log(
        'JobProcessor',
        'processJob',
        `Successfully processed all ${followingData.length} following relations`,
        workerId,
        { userId: job.user_id, totalFollowing: followingData.length }
      );
    }

    // Mark job as completed with final progress
    await updateJobProgress(
      job.id,
      {
        followers: followersData.length,
        following: followingData.length,
      },
      totalItems,
      workerId,
      'completed'
    );

    console.log(
      'JobProcessor',
      'processJob',
      'Job completed successfully',
      workerId,
      {
        jobId: job.id,
        metrics,
      }
    );
  } catch (error) {
    console.log(
      'JobProcessor',
      'processJob',
      'Job processing failed',
      workerId,
      {
        jobId: job.id,
        metrics,
      },
      error as Error
    );

    // Mark job as failed
    await updateJobProgress(
      job.id,
      {
        followers: metrics.processedItemsFollowers,
        following: metrics.processedItemsFollowing,
      },
      {
        followers: followersData?.length || 0,
        following: followingData?.length || 0
      },
      workerId,
      'failed',
      String(error)
    );
  } finally {
    await releaseLock(job.id, workerId);
    await cleanupTempFiles(job.file_paths, workerId);
  }
}

// Batch processing functions
async function batch_insert_followers(
  supabase: any,
  followersData: any[],
  relationsData: any[]
): Promise<{ error: any }> {
  try {
    const { error } = await supabase.rpc('batch_insert_followers', {
      followers_data: followersData,
      relations_data: relationsData
      // batch_size: BATCH_SIZE,
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
      relations_data: relationsData
    });
    return { error };
  } catch (error) {
    return { error };
  }
}

async function processFollowers(followers: any[], userId: string, workerId: string) {
  try {
    // Validation checks
    if (!followers || !Array.isArray(followers)) {
      const error = new Error('Followers data must be an array');
      console.log(
        'JobProcessor',
        'processFollowers',
        'Invalid followers data',
        workerId,
        { userId },
        error
      );
      throw error;
    }

    if (followers.length > 0) {
      const firstItem = followers[0];
      if (!firstItem?.follower?.accountId) {
        const error = new Error('Invalid follower data structure: missing accountId');
        console.log(
          'JobProcessor',
          'processFollowers',
          'Invalid follower data structure',
          workerId,
          { userId, sample: firstItem },
          error
        );
        throw error;
      }
    }

    // Create source if it doesn't exist
    await ensureSourceExists(userId, workerId);

    // Réduire la taille initiale des chunks pour éviter les timeouts
    let CHUNK_SIZE = 100; // Réduit de 150 à 100
    const MIN_CHUNK_SIZE = 20; // Taille minimale de chunk
    const MAX_RETRIES = 3;
    const BASE_DELAY = 500;
    
    // Tableau pour suivre les erreurs de timeout
    const timeoutErrors: any[] = [];

    for (let i = 0; i < followers.length;) {
      const chunk = followers.slice(i, i + CHUNK_SIZE);
      let retryCount = 0;
      let successfulProcessing = false;

      while (retryCount < MAX_RETRIES && !successfulProcessing) {
        try {
          // Prepare data for batch insertion
          const followersToInsert = chunk.map((item: any) => ({
            twitter_id: item.follower.accountId,
          }));

          const relationsToInsert = chunk.map((item: any) => ({
            source_id: userId,
            follower_id: item.follower.accountId,
          }));

          // Try batch insert
          const { error: batchError } = await batch_insert_followers(
            supabase,
            followersToInsert,
            relationsToInsert
          );

          if (batchError) {
            throw batchError;
          }

          // Log success
          console.log(` [Worker ${workerId}] Processed chunk ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(followers.length/CHUNK_SIZE)} (size: ${chunk.length})`);
          successfulProcessing = true;
          
          // Avancer au prochain chunk seulement en cas de succès
          i += CHUNK_SIZE;
          
        } catch (error) {
          retryCount++;
          const errorMsg = String(error);
          const isTimeoutError = errorMsg.includes('canceling statement due to statement timeout') || 
                                errorMsg.includes('57014');
          
          if (isTimeoutError) {
            timeoutErrors.push({ chunkSize: chunk.length, error: errorMsg });
            
            // Réduire la taille du chunk en cas de timeout
            CHUNK_SIZE = Math.max(MIN_CHUNK_SIZE, Math.floor(CHUNK_SIZE / 2));
            
            console.log(
              'JobProcessor',
              'processFollowers',
              `SQL timeout detected, reducing chunk size to ${CHUNK_SIZE}`,
              workerId,
              { userId, originalSize: chunk.length, newSize: CHUNK_SIZE }
            );
            
            // Si on a réduit la taille, on réessaie avec un chunk plus petit
            if (CHUNK_SIZE < chunk.length) {
              break; // Sortir de la boucle de retry pour réessayer avec un chunk plus petit
            }
          }
          
          console.log(
            'JobProcessor',
            'processFollowers',
            `Batch processing failed (attempt ${retryCount}/${MAX_RETRIES})`,
            workerId,
            { 
              userId,
              batchSize: chunk.length,
              batchIndex: i,
              retryCount,
              isTimeout: isTimeoutError
            },
            error as Error
          );

          if (retryCount === MAX_RETRIES) {
            throw error;
          }
          
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * BASE_DELAY));
        }
      }

      // Si on a réduit la taille du chunk mais qu'on n'a pas avancé (car on a fait un break),
      // on ne fait pas avancer i car on va réessayer avec un chunk plus petit
      
      // Add delay between chunks
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY * 2));
    }

    if (timeoutErrors.length > 0) {
      console.log(` [Worker ${workerId}] Completed with ${timeoutErrors.length} timeout adjustments`, 
        { timeoutErrors: timeoutErrors.slice(0, 3) }); // Log only first 3 for brevity
    }

    console.log(` [Worker ${workerId}] Successfully created ${followers.length} follower relations`);
  } catch (error) {
    console.log(
      'JobProcessor',
      'processFollowers',
      'Failed to process followers',
      workerId,
      { userId, totalFollowers: followers.length },
      error as Error
    );
    throw error;
  }
}

async function processFollowing(following: any[], userId: string, workerId: string) {
  try {
    // Validation checks
    if (!following || !Array.isArray(following)) {
      const error = new Error('Following data must be an array');
      console.log(
        'JobProcessor',
        'processFollowing',
        'Invalid following data',
        workerId,
        { userId },
        error
      );
      throw error;
    }

    if (following.length > 0) {
      const firstItem = following[0];
      if (!firstItem?.following?.accountId) {
        const error = new Error('Invalid following data structure: missing accountId');
        console.log(
          'JobProcessor',
          'processFollowing',
          'Invalid following data structure',
          workerId,
          { userId, sample: firstItem },
          error
        );
        throw error;
      }
    }

    // Create source if it doesn't exist
    await ensureSourceExists(userId, workerId);

    // Réduire la taille initiale des chunks pour éviter les timeouts
    let CHUNK_SIZE = 75; // Réduit de 150 à 75 (plus petit que pour followers)
    const MIN_CHUNK_SIZE = 20; // Taille minimale de chunk
    const MAX_RETRIES = 3;
    const BASE_DELAY = 500;
    
    // Tableau pour suivre les erreurs de timeout
    const timeoutErrors: any[] = [];

    for (let i = 0; i < following.length;) {
      const batch = following.slice(i, i + CHUNK_SIZE);
      let retryCount = 0;
      let successfulProcessing = false;

      while (retryCount < MAX_RETRIES && !successfulProcessing) {
        try {
          // Prepare data for batch insertion
          const targetsToInsert = batch.map((item: any) => ({
            twitter_id: item.following.accountId,
          }));

          const relationsToInsert = batch.map((item: any) => ({
            source_id: userId,
            target_twitter_id: item.following.accountId,
          }));

          // Try batch insert
          const { error: batchError } = await batch_insert_targets(
            supabase,
            targetsToInsert,
            relationsToInsert
          );

          if (batchError) {
            throw batchError;
          }

          // Log success
          console.log(` [Worker ${workerId}] Created ${batch.length} target relations for batch ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(following.length/CHUNK_SIZE)} (size: ${batch.length})`);
          successfulProcessing = true;
          
          // Avancer au prochain batch seulement en cas de succès
          i += CHUNK_SIZE;
          
        } catch (error) {
          retryCount++;
          const errorMsg = String(error);
          const isTimeoutError = errorMsg.includes('canceling statement due to statement timeout') || 
                                errorMsg.includes('57014');
          
          if (isTimeoutError) {
            timeoutErrors.push({ chunkSize: batch.length, error: errorMsg });
            
            // Réduire la taille du batch en cas de timeout
            CHUNK_SIZE = Math.max(MIN_CHUNK_SIZE, Math.floor(CHUNK_SIZE / 2));
            
            console.log(
              'JobProcessor',
              'processFollowing',
              `SQL timeout detected, reducing batch size to ${CHUNK_SIZE}`,
              workerId,
              { userId, originalSize: batch.length, newSize: CHUNK_SIZE }
            );
            
            // Si on a réduit la taille, on réessaie avec un batch plus petit
            if (CHUNK_SIZE < batch.length) {
              break; // Sortir de la boucle de retry pour réessayer avec un batch plus petit
            }
          }
          
          console.log(
            'JobProcessor',
            'processFollowing',
            `Batch processing failed (attempt ${retryCount}/${MAX_RETRIES})`,
            workerId,
            { 
              userId,
              batchSize: batch.length,
              batchIndex: i,
              retryCount,
              isTimeout: isTimeoutError
            },
            error as Error
          );

          if (retryCount === MAX_RETRIES) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * BASE_DELAY));
        }
      }
      
      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY * 2));
    }

    if (timeoutErrors.length > 0) {
      console.log(` [Worker ${workerId}] Completed with ${timeoutErrors.length} timeout adjustments`, 
        { timeoutErrors: timeoutErrors.slice(0, 3) }); // Log only first 3 for brevity
    }

    console.log(` [Worker ${workerId}] Successfully processed all ${following.length} following relations`);
  } catch (error) {
    console.log(
      'JobProcessor',
      'processFollowing',
      'Failed to process following',
      workerId,
      { userId, totalFollowing: following.length },
      error as Error
    );
    throw error;
  }
}