// worker/src/jobProcessor.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFile, unlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { createWriteStream, existsSync, promises as fs } from 'fs';
import { sleep } from './utils';

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
    console.error('❌ Missing environment variables:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey
    });
    process.exit(1);
  }

interface LockData {
  workerId: string;
  timestamp: number;
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
  status: 'processing' | 'completed' | 'failed' = 'processing'
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

  const { error } = await supabase
    .from('import_jobs')
    .update(updateData)
    .eq('id', jobId);

  if (error) {
    console.error(`❌ [Worker ${workerId}] Failed to update job progress:`, error);
  }
}

async function processBatch<T>(
  items: T[],
  startIndex: number,
  batchSize: number,
  processFn: (items: T[]) => Promise<void>,
  workerId: string,
  jobId: string,
  totalItems: { followers: number; following: number },
  type: 'followers' | 'following'
): Promise<void> {
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    try {
      const batch = items.slice(startIndex, startIndex + batchSize);
      if (batch.length === 0) return;

      await processFn(batch);
      
      // Update progress after successful batch
      const processedItems = {
        followers: type === 'followers' ? startIndex + batch.length : 0,
        following: type === 'following' ? startIndex + batch.length : 0
      };
      
      await updateJobProgress(jobId, processedItems, totalItems, workerId);
      
      return;
    } catch (error) {
      retries++;
      console.error(`Error ⚠️ [Worker ${workerId}] Batch processing failed (attempt ${retries}/${maxRetries}):`, error);
      
      if (retries === maxRetries) {
        throw new Error(`Error Failed to process batch after ${maxRetries} attempts`);
      }
      
      await sleep(Math.pow(2, retries) * 1000);
    }
  }
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
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
    console.error(`❌ [Worker ${workerId}] Error processing file ${filePath}:`, error);
    throw error;
  }
}

async function cleanupTempFiles(filePaths: string[], workerId: string) {
  try {
    // Supprimer d'abord les fichiers
    for (const path of filePaths) {
      try {
        await unlink(path);
        console.log(`✅ [Worker ${workerId}] Deleted file: ${path}`);
      } catch (error) {
        console.error(`❌ [Worker ${workerId}] Error deleting file ${path}:`, error);
        throw error; // Propager l'erreur pour éviter de supprimer le dossier
      }
    }

    // Si tous les fichiers ont été supprimés avec succès, supprimer le dossier
    if (filePaths.length > 0) {
      const userDir = dirname(filePaths[0]);
      await rm(userDir, { recursive: true });
      console.log(`✅ [Worker ${workerId}] Deleted directory: ${userDir}`);
    }
  } catch (error) {
    console.error(`❌ [Worker ${workerId}] Error during cleanup:`, error);
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
      console.error(`❌ [Worker ${workerId}] Error creating source:`, error);
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
  file_paths?: string[];
  job_type?: 'large_file_import' | 'direct_import';
  stats?: JobStats;
}

export async function processJob(job: ImportJob, workerId: string) {
  try {
    console.log(`🚀 [Worker ${workerId}] Starting job processing:`, job);

    // Acquire lock for this job
    if (!await acquireLock(job.id, workerId)) {
      console.log(`⏳ [Worker ${workerId}] Job ${job.id} is locked by another worker`);
      return;
    }

    let followersData: any[] = [];
    let followingData: any[] = [];
    let totalItems = {
      followers: 0,
      following: 0
    };
    
    // Pour suivre la progression
    let currentProgress = {
      followers: 0,
      following: 0
    };

    // Process each file
    if (job.file_paths) {
      for (const filePath of job.file_paths) {
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const data = await processTwitterFile(filePath, workerId);
        
        if (filePath.includes('follower.js')) {
          followersData = data;
          totalItems.followers = data.length;
        } else if (filePath.includes('following.js')) {
          followingData = data;
          totalItems.following = data.length;
        }
      }
    }

    // Ensure source exists
    await ensureSourceExists(job.user_id, workerId);

    // Process followers
    if (followersData.length > 0) {
      // console.log(`📊 [Worker ${workerId}] Processing ${followersData.length} followers`);
      for (let i = 0; i < followersData.length; i += BATCH_SIZE) {
        const batch = followersData.slice(i, i + BATCH_SIZE);
        await processFollowers(batch, job.user_id, workerId);
        
        // Mettre à jour la progression des followers
        currentProgress.followers = i + batch.length;
        
        // Envoyer la mise à jour avec les deux progressions
        await updateJobProgress(
          job.id,
          currentProgress,
          totalItems,
          workerId,
          'processing'
        );
      }
    }

    // Process following
    if (followingData.length > 0) {
      // console.log(`📊 [Worker ${workerId}] Processing ${followingData.length} following`);
      for (let i = 0; i < followingData.length; i += BATCH_SIZE) {
        const batch = followingData.slice(i, i + BATCH_SIZE);
        await processFollowing(batch, job.user_id, workerId);
        
        // Mettre à jour la progression des following
        currentProgress.following = i + batch.length;
        
        // Envoyer la mise à jour avec les deux progressions
        await updateJobProgress(
          job.id,
          currentProgress,
          totalItems,
          workerId,
          'processing'
        );
      }
    }

    // Mark job as completed with final progress
    await updateJobProgress(
      job.id,
      {
        followers: totalItems.followers,
        following: totalItems.following
      },
      totalItems,
      workerId,
      'completed'
    );

    // Update user onboarding status
    const { error: hasBoardError } = await supabaseAuth
      .from('users')
      .update({ has_onboarded: true })
      .eq('id', job.user_id);
    // console.log("error from updating has_onboarded", hasBoardError);
    // Release lock
    await releaseLock(job.id, workerId);
    
    if (hasBoardError) {
      console.error(`❌ [Worker ${workerId}] Error updating user has_onboarded:`, hasBoardError);
    }
    
    console.log(`✅ [Worker ${workerId}] Job completed successfully`);

    if (job.file_paths) {
      await cleanupTempFiles(job.file_paths, workerId);
    }
  } catch (error) {
    console.error(`❌ [Worker ${workerId}] Job processing failed:`, error);
    console.log(error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ [Worker ${workerId}] Job processing failed:`, errorMessage);
    await supabase
      .from('import_jobs')
      .update({
        status: 'failed',
        error_log: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Release lock
    await releaseLock(job.id, workerId);
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
  console.log(` [Worker ${workerId}] Processing ${followers.length} follower relations`);

  try {
    // Validation checks
    if (!followers || !Array.isArray(followers)) {
      throw new Error('Followers data must be an array');
    }

    if (followers.length > 0) {
      const firstItem = followers[0];
      if (!firstItem?.follower?.accountId) {
        console.error('Invalid follower data structure:', firstItem);
        throw new Error('Invalid follower data structure: missing accountId');
      }
    }

    // Create source if it doesn't exist
    await ensureSourceExists(userId, workerId);

    const CHUNK_SIZE = 150;
    const MAX_RETRIES = 3;
    const BASE_DELAY = 500;

    for (let i = 0; i < followers.length; i += CHUNK_SIZE) {
      const chunk = followers.slice(i, i + CHUNK_SIZE);
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
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
          console.log(` [Worker ${workerId}] Processed chunk ${i/CHUNK_SIZE + 1}/${Math.ceil(followers.length/CHUNK_SIZE)}`);
          break;

        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRIES) {
            throw new Error(`Failed after ${MAX_RETRIES} retries: ${error instanceof Error ? error.message : String(error)}`);
          }
          // Exponential backoff
          const delay = Math.pow(2, retryCount) * BASE_DELAY;
          console.log(` [Worker ${workerId}] Retry ${retryCount}/${MAX_RETRIES} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Add delay between chunks
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY * 2));
    }

    console.log(` [Worker ${workerId}] Successfully created ${followers.length} follower relations`);
  } catch (error) {
    console.error(` [Worker ${workerId}] Error in processFollowers:`, error);
    throw error;
  }
}

async function processFollowing(following: any[], userId: string, workerId: string) {
  console.log(` [Worker ${workerId}] Processing ${following.length} following relations`);

  try {
    // Validation checks
    if (!following || !Array.isArray(following)) {
      throw new Error('Following data must be an array');
    }

    if (following.length > 0) {
      const firstItem = following[0];
      if (!firstItem?.following?.accountId) {
        console.error('Invalid following data structure:', firstItem);
        throw new Error('Invalid following data structure: missing accountId');
      }
    }

    // Create source if it doesn't exist
    await ensureSourceExists(userId, workerId);

    const CHUNK_SIZE = 150;
    const MAX_RETRIES = 3;
    const BASE_DELAY = 500;

    for (let i = 0; i < following.length; i += CHUNK_SIZE) {
      const batch = following.slice(i, i + CHUNK_SIZE);
      let retryCount = 0;

      while (retryCount < MAX_RETRIES) {
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
          console.log(` [Worker ${workerId}] Created ${batch.length} target relations for batch ${Math.floor(i/CHUNK_SIZE) + 1}/${Math.ceil(following.length/CHUNK_SIZE)}`);
          break;

        } catch (error) {
          retryCount++;
          if (retryCount === MAX_RETRIES) {
            throw new Error(`Failed after ${MAX_RETRIES} retries: ${error instanceof Error ? error.message : String(error)}`);
          }
          // Exponential backoff
          const delay = Math.pow(2, retryCount) * BASE_DELAY;
          console.log(` [Worker ${workerId}] Retry ${retryCount}/${MAX_RETRIES} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Add delay between chunks
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY * 2));
    }

    console.log(` [Worker ${workerId}] Successfully processed all ${following.length} following relations`);
  } catch (error) {
    console.error(` [Worker ${workerId}] Error in processFollowing:`, error);
    throw error;
  }
}