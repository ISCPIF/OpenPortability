// python_worker/src/index.ts
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { processPythonTask } from './PythonProcessor';
import fs from 'fs'; // Import fs
import path from 'path'; // Import path

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
  pollingInterval: number;
  stalledTaskTimeout: number;
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
  id: 'python_worker_1',
  pollingInterval: 5000,      // 5 secondes
  stalledTaskTimeout: 60000,  // 1 minute
};

const WORKER_CONFIG: WorkerConfig = {
  id: process.env.PYTHON_WORKER_ID || DEFAULT_CONFIG.id,
  pollingInterval: parseInt(process.env.PYTHON_WORKER_POLLING_INTERVAL || String(DEFAULT_CONFIG.pollingInterval)),
  stalledTaskTimeout: parseInt(process.env.PYTHON_WORKER_STALLED_TASK_TIMEOUT || String(DEFAULT_CONFIG.stalledTaskTimeout)),
};

console.log('🐍 [Python Worker] Starting with config:', WORKER_CONFIG);

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

// Classes d'erreurs spécifiques
class WorkerError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'WorkerError';
  }
}

class SupabaseError extends WorkerError {
  constructor(message: string, public readonly originalError: any) {
    super(message, 'SUPABASE_ERROR');
    this.name = 'SupabaseError';
  }
}

class CircuitBreakerError extends WorkerError {
  constructor(message: string = 'Circuit breaker is open') {
    super(message, 'CIRCUIT_BREAKER_ERROR');
    this.name = 'CircuitBreakerError';
  }
}

class TaskProcessingError extends WorkerError {
  constructor(message: string, public readonly taskId: string) {
    super(message, 'TASK_PROCESSING_ERROR');
    this.name = 'TaskProcessingError';
  }
}

class StalledTaskError extends WorkerError {
  constructor(message: string, public readonly taskId: string) {
    super(message, 'STALLED_TASK_ERROR');
    this.name = 'StalledTaskError';
  }
}

// Récupérer les tâches bloquées
async function recoverStalledTasks() {
  try {
    // Récupérer les tâches au statut 'processing' bloquées depuis trop longtemps
    const { data, error } = await supabase
      .from('python_tasks')
      .update({ status: 'pending', updated_at: new Date().toISOString() })
      .match({ status: 'processing' })
      .lt('updated_at', new Date(Date.now() - WORKER_CONFIG.stalledTaskTimeout).toISOString())
      .select();
    
    if (error) {
      console.error(`❌ [Python Worker ${WORKER_CONFIG.id}] Error recovering stalled tasks:`, error);
      return;
    }
    
    if (data && data.length > 0) {
      console.log(`🔄 [Python Worker ${WORKER_CONFIG.id}] Recovered ${data.length} stalled tasks.`);
    }
  } catch (error) {
    console.error(`❌ [Python Worker ${WORKER_CONFIG.id}] Error in recoverStalledTasks:`, error);
  }
}

// Fonction pour trouver et traiter une tâche
async function findAndProcessTask(workerId: string, allMessages: AllMessages): Promise<void> {
  try {
    // Utiliser la fonction claim_next_pending_task pour récupérer et verrouiller la prochaine tâche
    const { data: tasks, error } = await supabase
      .rpc('claim_next_pending_task', { 
        worker_id_input: workerId 
      });

    if (error) {
      console.error(`❌ [Python Worker ${workerId}] Error claiming next task:`, error);
      return;
    }

    console.log("task -->", tasks)

    if (!tasks || tasks.length === 0) {
      return;
    }

    const task = tasks[0];
    
    if (task.scheduled_for) {
      const scheduledHour = new Date(task.scheduled_for);
      console.log(`🔍 [Python Worker ${workerId}] Claimed task: ${task.id} (type: ${task.task_type}) scheduled for ${scheduledHour.toISOString()}`);
    } else {
      console.log(`🔍 [Python Worker ${workerId}] Claimed task: ${task.id} (type: ${task.task_type})`);
    }

    // Traiter la tâche en passant les messages chargés
    await processPythonTask(task, workerId, allMessages);

  } catch (error) {
    console.error(`❌ [Python Worker ${workerId}] Error in findAndProcessTask:`, error);
  }
}

// Fonction utilitaire pour les appels Supabase sécurisés
async function safeSupabaseCall<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    console.error(`❌ [Python Worker ${WORKER_CONFIG.id}] Supabase error:`, error);
    throw new SupabaseError('Supabase operation failed', error);
  }
}

// Fonction utilitaire pour attendre
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fonction utilitaire pour attendre un temps aléatoire
function randomSleep(min: number, max: number): Promise<void> {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return sleep(delay);
}

// Démarrer le worker
async function startWorker() {
  let running = true;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 10;
  
  console.log(`🚀 [Python Worker ${WORKER_CONFIG.id}] Worker started`);
  
  while (running) {
    try {
      // Vérifier les tâches bloquées
      await recoverStalledTasks();
      
      // Attendre un peu pour éviter les collisions avec d'autres workers
      await randomSleep(100, 500);
      
      // Trouver et traiter une tâche, en passant les messages chargés
      await findAndProcessTask(WORKER_CONFIG.id, ALL_MESSAGES);
      
      // Réinitialiser le compteur d'erreurs si tout va bien
      consecutiveErrors = 0;
      
    } catch (error) {
      consecutiveErrors++;
      console.error(`❌ [Python Worker ${WORKER_CONFIG.id}] Error in worker loop (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`, error);
      
      // Circuit breaker pattern
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`🔥 [Python Worker ${WORKER_CONFIG.id}] Circuit breaker triggered - too many consecutive errors!`);
        process.exit(1);
      }
      
      // Attendre plus longtemps en cas d'erreur
      await sleep(WORKER_CONFIG.pollingInterval * 2);
    }
    
    // Attendre avant la prochaine vérification
    await sleep(WORKER_CONFIG.pollingInterval);
  }
}

// Gestion des signaux d'arrêt
process.on('SIGTERM', () => {
  console.log(`👋 [Python Worker ${WORKER_CONFIG.id}] Received SIGTERM, shutting down gracefully...`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`👋 [Python Worker ${WORKER_CONFIG.id}] Received SIGINT, shutting down gracefully...`);
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(`🔥 [Python Worker ${WORKER_CONFIG.id}] Unhandled Rejection at:`, promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error(`🔥 [Python Worker ${WORKER_CONFIG.id}] Uncaught Exception:`, error);
  process.exit(1);
});

// Démarrer le worker
startWorker().catch(error => {
  console.error(`💥 [Python Worker ${WORKER_CONFIG.id}] Failed to start worker:`, error);
  process.exit(1);
});