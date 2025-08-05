// python_worker/src/index.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { processPythonTask, PythonTask } from './PythonProcessor';
import fs from 'fs';
import path from 'path';
import redis from './redisClient';

// Charger les variables d'environnement au tout début
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Configuration du worker
interface WorkerConfig {
  id: string;
  maxRetries: number;
}

// Interface pour la structure des messages (partagée)
interface Messages {
  testDm: string;
  recoNewsletter: {
    singular: string;
    plural: string;
  };
}

// Type pour l'objet contenant toutes les langues
type AllMessages = Record<string, Messages>;

const DEFAULT_CONFIG: WorkerConfig = {
  id: process.env.WORKER_ID || 'python_worker_1',
  maxRetries: 3
};

const WORKER_CONFIG: WorkerConfig = {
  ...DEFAULT_CONFIG,
  id: process.env.WORKER_ID || DEFAULT_CONFIG.id,
  maxRetries: parseInt(process.env.MAX_RETRIES || '3')
};

// Fonction pour charger tous les messages depuis le dossier messages
function loadAllMessages(): AllMessages {
  const messagesDir = path.join(__dirname, '../messages');
  const allMessages: AllMessages = {};
  const defaultLang = 'en';

  try {
    const files = fs.readdirSync(messagesDir);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const lang = file.split('.')[0];
        const filePath = path.join(messagesDir, file);
        try {
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          allMessages[lang] = JSON.parse(fileContent) as Messages;
          console.log(`🌐 Loaded messages for language: ${lang}`);
        } catch (error) {
          console.error(`❌ Error loading or parsing ${filePath}:`, error);
        }
      }
    });
  } catch (error) {
    console.error(`❌ Error reading messages directory ${messagesDir}:`, error);
  }

  // Vérifier que l'anglais (fallback) est chargé
  if (!allMessages[defaultLang]) {
    console.error(`❌ Critical: Default language '${defaultLang}' messages not found or failed to load!`);
    // Optionally, provide hardcoded fallback if even EN fails
    allMessages[defaultLang] = {
        testDm: "This is an automated test message from OpenPortability to verify we can reach you via DM. No action is required.",
        recoNewsletter: {
            singular: "Hello! There is ${count} person you followed on Twitter who is now on ${platformName}! Visit openportability.org to find them 🚀",
            plural: "Hello! There are ${count} people you followed on Twitter who are now on ${platformName}! Visit openportability.org to find them 🚀"
        }
    };
  }

  return allMessages;
}

// Charger tous les messages UNE SEULE FOIS au démarrage
const ALL_MESSAGES = loadAllMessages();

/**
 * Consomme une tâche depuis Redis (priorité) ou PostgreSQL (fallback)
 */
async function consumeTask(workerId: string): Promise<PythonTask | null> {
  try {
    // 1. Essayer Redis d'abord - chercher dans toutes les queues disponibles
    const allKeys = await redis.keys('consent_tasks:*');
    console.log(`🔍 [Worker ${workerId}] All consent_tasks keys in Redis: ${allKeys.join(', ') || 'none'}`);
    
    if (allKeys.length > 0) {
      // Trier les clés par date (plus récentes en premier)
      const sortedKeys = allKeys.sort().reverse();
      
      for (const queueKey of sortedKeys) {
        const queueLength = await redis.llen(queueKey);
        console.log(`🔍 [Worker ${workerId}] Redis queue ${queueKey} length: ${queueLength}`);
        
        if (queueLength > 0) {
          try {
            const result = await redis.brpop(queueKey, 1); // 1 seconde timeout par queue
            if (result) {
              const taskData = JSON.parse(result[1]);
              console.log(`📥 [Worker ${workerId}] Got Redis task from ${queueKey}: ${taskData.id} (${taskData.task_type})`);
              
              // Convertir le payload Redis en format PythonTask
              const pythonTask: PythonTask = {
                id: taskData.id,
                user_id: taskData.user_id,
                status: 'processing',
                task_type: taskData.task_type,
                platform: taskData.platform,
                payload: { handle: taskData.handle },
                worker_id: workerId,
                created_at: taskData.created_at,
                updated_at: new Date().toISOString(),
                result: null,
                error_log: null,
                scheduled_for: undefined
              };
              
              // Mettre à jour le statut en DB pour indiquer que le worker traite la tâche
              try {
                await updateTaskStatus(taskData.id, 'processing');
              } catch (updateError) {
                console.log(`⚠️ [Worker ${workerId}] Could not update task status in DB (task may not exist yet):`, updateError instanceof Error ? updateError.message : String(updateError));
              }
              
              return pythonTask;
            }
          } catch (redisError) {
            console.log(`❌ [Worker ${workerId}] Redis error on queue ${queueKey}:`, redisError instanceof Error ? redisError.message : String(redisError));
            // Si erreur Redis sur cette queue, essayer la suivante
            continue;
          }
        }
      }
    }
    
    console.log(`📥 [Worker ${workerId}] No Redis task found, checking PostgreSQL fallback`);
    
  } catch (redisError) {
    // Si Redis complètement down, utiliser seulement PostgreSQL
    console.log(`❌ [Worker ${workerId}] Redis completely down:`, redisError instanceof Error ? redisError.message : String(redisError));
  }

  // 2. Fallback PostgreSQL - récupérer une tâche pending
  try {
    const { data: tasks, error: dbError } = await supabase
      .rpc('claim_next_pending_task', { 
        worker_id_param: workerId 
      });

    if (dbError) {
      console.log(`❌ [Worker ${workerId}] PostgreSQL RPC error:`, dbError.message);
      return null;
    }

    if (tasks && tasks.length > 0) {
      console.log(`📥 [Worker ${workerId}] Got PostgreSQL task: ${tasks[0].id} (${tasks[0].task_type})`);
      return tasks[0];
    }
    
    return null;
  } catch (dbError) {
    console.log(`❌ [Worker ${workerId}] PostgreSQL fallback failed:`, dbError instanceof Error ? dbError.message : String(dbError));
    return null;
  }
}

/**
 * Met à jour le statut d'une tâche dans la base de données
 */
async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'waiting',
  result: Record<string, any> | null = null,
  errorLog: string | null = null
): Promise<void> {
  try {
    const { error } = await supabase
      .from('python_tasks')
      .update({
        status,
        result,
        error_log: errorLog,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) throw error;
  } catch (error) {
    console.log('PythonWorker', 'updateTaskStatus', `Failed to update task status`, taskId, { status, error });
    throw error;
  }
}

/**
 * Reprogramme une tâche newsletter en cas d'échec (utilise scheduled_for)
 */
async function rescheduleNewsletterTask(taskId: string): Promise<void> {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const { error } = await supabase
    .from('python_tasks')
    .update({
      status: 'pending',
      scheduled_for: nextWeek.toISOString(),
      worker_id: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', taskId);

  if (error) throw error;
}

/**
 * Traite une tâche avec retry logic (3 tentatives)
 */
async function processTaskWithRetry(task: PythonTask, workerId: string, allMessages: AllMessages): Promise<void> {
  let attempt = 0;
  
  while (attempt < WORKER_CONFIG.maxRetries) {
    try {
      console.log(`🔄 [Worker ${workerId}] Processing ${task.task_type} (attempt ${attempt + 1}/${WORKER_CONFIG.maxRetries})`);
      
      // Traiter la tâche en passant les messages chargés
      await processPythonTask(task, workerId, allMessages);
      
      // Succès : marquer comme completed
      await updateTaskStatus(task.id, 'completed', { success: true });
      console.log(`✅ [Worker ${workerId}] Task ${task.id} completed successfully`);
      return;
      
    } catch (error: any) {
      attempt++;
      console.log(`❌ [Worker ${workerId}] Task ${task.id} failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
      
      if (attempt >= WORKER_CONFIG.maxRetries) {
        // Échec définitif
        await updateTaskStatus(task.id, 'failed', null, error instanceof Error ? error.message : String(error));
        
        if (task.task_type === 'send-reco-newsletter') {
          // Reprogrammer dans 1 semaine en utilisant scheduled_for
          await rescheduleNewsletterTask(task.id);
          console.log(`📅 [Worker ${workerId}] Newsletter task ${task.id} rescheduled for next week`);
        }
        // Si test-dm failed : ne rien faire (pas de newsletter créée)
        return;
      }
      
      // Attendre avant retry (backoff exponentiel)
      const backoffMs = 1000 * Math.pow(2, attempt);
      await sleep(backoffMs);
    }
  }
}

// Fonction utilitaire pour attendre
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Worker principal - consommation réactive
 */
async function startWorker() {
  console.log(`🚀 [Python Worker ${WORKER_CONFIG.id}] Started (Redis-first architecture)`);
  
  // Test de santé Redis au démarrage
  const redisHealthy = await redis.healthCheck();
  console.log(`🔍 [Worker ${WORKER_CONFIG.id}] Redis health: ${redisHealthy ? '✅ OK' : '❌ DOWN'}`);
  
  while (true) {
    try {
      // Consommer une tâche (Redis → PostgreSQL fallback)
      const task = await consumeTask(WORKER_CONFIG.id);
      
      if (task) {
        await processTaskWithRetry(task, WORKER_CONFIG.id, ALL_MESSAGES);
      } else {
        // Aucune tâche trouvée - attendre 2 minutes avant de réessayer
        console.log(`😴 [Worker ${WORKER_CONFIG.id}] No tasks found, sleeping for 2 minutes...`);
        await sleep(120000); // 2 minutes = 120000ms
      }
      
    } catch (error: any) {
      console.log('PythonWorker', 'startWorker', error, undefined, undefined, undefined, undefined, WORKER_CONFIG.id);
      await sleep(5000); // Attendre 5s en cas d'erreur
    }
  }
}

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => {
  console.log(`👋 [Python Worker ${WORKER_CONFIG.id}] Received SIGTERM, shutting down gracefully...`);
  redis.disconnect();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`👋 [Python Worker ${WORKER_CONFIG.id}] Received SIGINT, shutting down gracefully...`);
  redis.disconnect();
  process.exit(0);
});

process.on('uncaughtException', (error: any) => {
  console.log('PythonWorker', 'uncaughtException', error, undefined, undefined, undefined, undefined, WORKER_CONFIG.id);
  redis.disconnect();
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  console.log('PythonWorker', 'unhandledRejection', `Unhandled Rejection at: ${promise}, reason: ${reason}`, undefined, undefined, undefined, undefined, WORKER_CONFIG.id);
});

// Démarrer le worker
startWorker().catch((error: any) => {
  console.error('❌ Failed to start worker:', error);
  redis.disconnect();
  process.exit(1);
});