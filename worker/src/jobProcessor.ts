// worker/src/jobProcessor.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { readFile, unlink, rm } from 'fs/promises';
import { join, dirname } from 'path';

// Charger les variables d'environnement
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Configuration
const BATCH_SIZE = 1000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 3000;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
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

const TEMP_UPLOAD_DIR = join(process.cwd(), 'tmp', 'uploads');

// Attendre un certain temps
async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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

async function processTwitterFile(filePath: string): Promise<any[]> {
  try {
    console.log(`📖 [Worker] Reading file: ${filePath}`);
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
    console.log(`✅ [Worker] Successfully parsed ${data.length} items from ${filePath}`);
    return data;
  } catch (error) {
    console.error(`❌ [Worker] Error processing file ${filePath}:`, error);
    throw error;
  }
}

async function processBatch<T>(
  items: T[],
  startIndex: number,
  batchSize: number,
  processFn: (items: T[]) => Promise<void>
): Promise<void> {
  const endIndex = Math.min(startIndex + batchSize, items.length);
  const batch = items.slice(startIndex, endIndex);
  
  if (batch.length === 0) return;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await processFn(batch);
      return;
    } catch (error) {
      console.error(`❌ [Worker] Error processing batch (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      if (attempt === MAX_RETRIES - 1) throw error;
      await sleep(RETRY_DELAY);
    }
  }
}

interface ImportJob {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  current_batch: number;
  total_items: number;
  error_log?: string;
  file_paths?: string[];
  job_type?: 'large_file_import' | 'direct_import';
}

async function updateJobProgress(jobId: string, processedItems: number, totalItems: number) {
  const progress = (processedItems / totalItems) * 100;
  await supabase
    .from('import_jobs')
    .update({ 
      current_batch: processedItems,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

async function cleanupTempFiles(filePaths: string[]) {
  try {
    // Supprimer d'abord les fichiers
    for (const path of filePaths) {
      try {
        await unlink(path);
        console.log(`✅ [Worker] Deleted file: ${path}`);
      } catch (error) {
        console.error(`❌ [Worker] Error deleting file ${path}:`, error);
        throw error; // Propager l'erreur pour éviter de supprimer le dossier
      }
    }

    // Si tous les fichiers ont été supprimés avec succès, supprimer le dossier
    if (filePaths.length > 0) {
      const userDir = dirname(filePaths[0]);
      await rm(userDir, { recursive: true });
      console.log(`✅ [Worker] Deleted directory: ${userDir}`);
    }
  } catch (error) {
    console.error('❌ [Worker] Error during cleanup:', error);
    throw error;
  }
}

async function ensureSourceExists(userId: string) {
  // Vérifier si la source existe déjà
  const { data: source } = await supabase
    .from('sources')
    .select('id')
    .eq('id', userId)
    .single();

  // Si la source n'existe pas, la créer
  if (!source) {
    console.log(`📝 [Worker] Creating source for user ${userId}`);
    const { error } = await supabase
      .from('sources')
      .insert({ id: userId });

    if (error) {
      console.error('❌ [Worker] Error creating source:', error);
      throw error;
    }
  }
}

export async function processJob(job: ImportJob) {
  console.log(`🚀 [Worker] Starting job processing: ${job.id}`);
  
  try {
    // Marquer le job comme en cours
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString(),
        stats: {
          followers: 0,
          following: 0,
          total: 0,
          processed: 0
        }
      })
      .eq('id', job.id);

    if (!job.job_type || !job.file_paths?.length) {
      throw new Error('Invalid job type or missing file paths');
    }

    console.log(`📂 [Worker] Processing ${job.file_paths.length} files for job ${job.id}`);
    
    let processedItems = 0;
    let followersCount = 0;
    let followingCount = 0;
    
    // Traiter chaque fichier séparément
    for (const filePath of job.file_paths) {
      const data = await processTwitterFile(filePath);
      const isFollowing = filePath.toLowerCase().includes('following');
      
      // Mettre à jour les compteurs
      if (isFollowing) {
        followingCount = data.length;
      } else {
        followersCount = data.length;
      }
      
      // Mettre à jour les stats totales
      const totalItems = followersCount + followingCount;
      await supabase
        .from('import_jobs')
        .update({ 
          total_items: totalItems,
          stats: {
            followers: followersCount,
            following: followingCount,
            total: totalItems,
            processed: processedItems
          }
        })
        .eq('id', job.id);
      
      console.log(`📊 [Worker] Processing ${data.length} ${isFollowing ? 'following' : 'followers'}`);
      
      // Traiter par lots
      console.log(`🔄 [Worker] Processing in batches of ${BATCH_SIZE}`);
      for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        await processBatch(
          batch,
          0,
          batch.length,
          async (items) => {
            if (isFollowing) {
              await processFollowing(items, job.user_id);
            } else {
              await processFollowers(items, job.user_id);
            }
            processedItems += batch.length;
            await supabase
              .from('import_jobs')
              .update({ 
                stats: {
                  followers: followersCount,
                  following: followingCount,
                  total: totalItems,
                  processed: processedItems
                }
              })
              .eq('id', job.id);
          }
        );
        // Petit délai entre les lots
        await sleep(100);
      }
    }

    // Nettoyer les fichiers temporaires seulement si tout a réussi
    await cleanupTempFiles(job.file_paths);

    // Marquer le job comme terminé
    console.log(`✅ [Worker] Job ${job.id} completed successfully`);
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Marquer l'utilisateur comme onboarded
    await supabaseAuth
      .from('users')
      .update({ has_onboarded: true })
      .eq('id', job.user_id);

  } catch (error) {
    console.error(`❌ [Worker] Error processing job ${job.id}:`, error);
    
    // En cas d'erreur, ne pas supprimer les fichiers pour permettre le débogage
    // Marquer le job comme échoué
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'failed',
        error_log: (error as any).message || 'Unknown error',
        updated_at: new Date().toISOString()
      })
      .eq('id', job.id);

    throw error;
  }
}

async function processFollowers(followers: any[], userId: string) {
  console.log(` [Worker] Processing ${followers.length} follower relations`);

  // Créer la source si elle n'existe pas
  await ensureSourceExists(userId);

  // Insérer les followers (table followers)
  const { error: followersError } = await supabase
    .from('followers')
    .upsert(
      followers.map((item: any) => ({
        twitter_id: item.follower.accountId,
      })),
      { onConflict: 'twitter_id' }
    );

  if (followersError) {
    console.error(' [Worker] Error inserting followers:', followersError);
    throw followersError;
  }

  // Créer les relations (table sources_followers)
  const { error: relationsError } = await supabase
    .from('sources_followers')
    .upsert(
      followers.map((item: any) => ({
        source_id: userId,
        follower_id: item.follower.accountId,
      })),
      { onConflict: 'source_id,follower_id' }
    );

  if (relationsError) {
    console.error(' [Worker] Error inserting follower relations:', relationsError);
    throw relationsError;
  }

  console.log(` [Worker] Created ${followers.length} follower relations`);
}

async function processFollowing(following: any[], userId: string) {
  console.log(` [Worker] Processing ${following.length} following relations`);

  // Créer la source si elle n'existe pas
  await ensureSourceExists(userId);

  // D'abord, insérer les targets
  const { error: targetsError } = await supabase
    .from('targets')
    .upsert(
      following.map((item: any) => ({
        twitter_id: item.following.accountId,
      })),
      { onConflict: 'twitter_id' }
    );

  if (targetsError) {
    console.error(' [Worker] Error inserting targets:', targetsError);
    throw targetsError;
  }

  // Ensuite, créer les relations
  const { error: relationsError } = await supabase
    .from('sources_targets')
    .upsert(
      following.map((item: any) => ({
        source_id: userId,
        target_twitter_id: item.following.accountId,
      })),
      { onConflict: 'source_id,target_twitter_id' }
    );

  if (relationsError) {
    console.error(' [Worker] Error inserting following relations:', relationsError);
    throw relationsError;
  }
  console.log(` [Worker] Created ${following.length} target relations`);
}