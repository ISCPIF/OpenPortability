// python_worker/src/PythonProcessor.ts
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as dotenv from 'dotenv';

// Promisify exec pour utiliser async/await
const execPromise = promisify(exec);

// Charger les variables d'environnement
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

// Types de tâches supportés
export type PythonTaskType = 'test-dm' | 'send-reco-newsletter';

// Interface pour une tâche Python
export interface PythonTask {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  task_type: PythonTaskType;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error_log?: string | null;
  created_at: string;
  updated_at: string;
  worker_id?: string | null;
}

/**
 * Met à jour le statut d'une tâche dans la base de données
 */
async function updateTaskStatus(
  taskId: string, 
  status: 'pending' | 'processing' | 'completed' | 'failed',
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
      .match({ id: taskId });
    
    if (error) {
      console.error(`❌ Error updating task status:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error in updateTaskStatus for task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Exécute le test DM via le script Python
 */
async function executeTestDm(task: PythonTask, workerId: string): Promise<Record<string, any>> {
  try {
    console.log(`🐍 [Python Worker ${workerId}] Executing test-dm for user ${task.user_id} with handle ${task.payload.handle}`);
    
    // Vérifier que le payload contient un handle Bluesky
    if (!task.payload.handle) {
      throw new Error('Missing Bluesky handle in task payload');
    }
    
    // Chemin vers le script Python
    const scriptPath = path.resolve(process.cwd(), './testDm.py');
    
    // Exécuter le script Python avec le handle comme argument en utilisant l'environnement virtuel
    const pythonExecutable = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : 'python3';
    const { stdout, stderr } = await execPromise(`${pythonExecutable} ${scriptPath} ${task.payload.handle}`);
    
    console.log(`🐍 [Python Worker ${workerId}] test-dm script output:`, stdout);
    
    if (stderr && !stdout.includes('Successfully sent DM') && !stdout.includes('Message envoyé avec succès')) {
      console.error(`❌ [Python Worker ${workerId}] test-dm script error:`, stderr);
      
      // Déterminer si l'utilisateur doit suivre la plateforme
      if (stderr.includes('recipient requires incoming messages to come from someone they follow') ||
          stdout.includes('recipient requires incoming messages to come from someone they follow') ||
          stderr.includes('recipient has disabled incoming messages') ||
          stdout.includes('recipient has disabled incoming messages')) {
        return {
          success: false,
          error: 'DM failed: User needs to follow the platform',
          needs_follow: true
        };
      }
      
      return {
        success: false,
        error: stderr
      };
    }
    
    // Vérifier si le DM a été envoyé avec succès
    if (stdout.includes('Successfully sent DM') || stdout.includes('Message envoyé avec succès')) {
      return {
        success: true
      };
    }
    
    // Retourner une erreur générique dans les autres cas
    return {
      success: false,
      error: 'Unknown error sending DM'
    };
  } catch (error) {
    console.error(`❌ [Python Worker ${workerId}] Error in executeTestDm:`, error);
    throw error;
  }
}

/**
 * Exécute l'envoi de newsletter de recommandations
 */
async function executeSendRecoNewsletter(task: PythonTask, workerId: string): Promise<Record<string, any>> {
  try {
    console.log(`🐍 [Python Worker ${workerId}] Executing send-reco-newsletter for user ${task.user_id}`);
    
    // Chemin vers le script Python
    const scriptPath = path.resolve(process.cwd(), './sendRecoNewsletter.py');
    
    // Préparer les arguments JSON pour le script
    const jsonArgs = JSON.stringify(task.payload);
    
    // Exécuter le script Python avec les arguments JSON en utilisant l'environnement virtuel
    const pythonExecutable = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : 'python3';
    const { stdout, stderr } = await execPromise(`${pythonExecutable} ${scriptPath} '${jsonArgs}'`);
    
    console.log(`🐍 [Python Worker ${workerId}] send-reco-newsletter script output:`, stdout);
    
    if (stderr) {
      console.error(`❌ [Python Worker ${workerId}] send-reco-newsletter script error:`, stderr);
      return {
        success: false,
        error: stderr
      };
    }
    
    // Analyser la sortie JSON
    try {
      const result = JSON.parse(stdout);
      return {
        success: true,
        ...result
      };
    } catch (e) {
      return {
        success: true,
        raw_output: stdout
      };
    }
  } catch (error) {
    console.error(`❌ [Python Worker ${workerId}] Error in executeSendRecoNewsletter:`, error);
    throw error;
  }
}

/**
 * Traite une tâche Python en fonction de son type
 */
export async function processPythonTask(task: PythonTask, workerId: string): Promise<void> {
  console.log(`🐍 [Python Worker ${workerId}] Processing task ${task.id} of type ${task.task_type}`);
  
  try {
    let result: Record<string, any>;
    
    // Exécuter la fonction appropriée selon le type de tâche
    switch (task.task_type) {
      case 'test-dm':
        result = await executeTestDm(task, workerId);
        break;
        
      case 'send-reco-newsletter':
        result = await executeSendRecoNewsletter(task, workerId);
        break;
        
      default:
        throw new Error(`Unsupported task type: ${task.task_type}`);
    }
    
    // Mettre à jour le statut de la tâche
    await updateTaskStatus(
      task.id, 
      result.success ? 'completed' : 'failed',
      result,
      result.success ? null : result.error
    );
    
    console.log(`✅ [Python Worker ${workerId}] Task ${task.id} ${result.success ? 'completed' : 'failed'}`);
    
  } catch (error) {
    console.error(`❌ [Python Worker ${workerId}] Error processing task ${task.id}:`, error);
    
    // Mettre à jour le statut en cas d'erreur
    try {
      await updateTaskStatus(
        task.id,
        'failed',
        null,
        error instanceof Error ? error.message : String(error)
      );
    } catch (updateError) {
      console.error(`💥 [Python Worker ${workerId}] Failed to update task status:`, updateError);
    }
  }
}