// python_worker/src/PythonProcessor.ts
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as dotenv from 'dotenv';
import logger from './log_utils';

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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'waiting';
  task_type: PythonTaskType;
  payload: Record<string, any>;
  result?: Record<string, any> | null;
  error_log?: string | null;
  created_at: string;
  updated_at: string;
  worker_id?: string | null;
  platform: 'bluesky' | 'mastodon';
  scheduled_for?: string;
}

// Interface pour la structure des messages (peut être déplacée ou partagée si nécessaire)
interface Messages {
  testDm: string;
  recoNewsletter: {
    singular: string;
    plural: string;
  };
}

// Type pour l'objet contenant toutes les langues (peut être partagé depuis index.ts)
type AllMessages = Record<string, Messages>;

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
        status: status as string, // Cast en string pour éviter les guillemets
        result,
        error_log: errorLog,
        worker_id: status === 'pending' ? null : undefined, // Réinitialiser worker_id si pending
        updated_at: new Date().toISOString()
      })
      .match({ id: taskId });
    
    if (error) {
      logger.logError('PythonProcessor', 'updateTaskStatus', `Error updating task status: ${error.message}`, undefined, { taskId, status });
      throw error;
    }
  } catch (error) {
    logger.logError('PythonProcessor', 'updateTaskStatus', error instanceof Error ? error : String(error), undefined, { taskId });
    throw error;
  }
}

/**
 * Met à jour le statut de support personnalisé pour un utilisateur
 */
async function updatePersonalizedSupportStatus(
  userId: string,
  platform: 'bluesky' | 'mastodon',
  isActive: boolean
): Promise<void> {
  try {
    // Vérifier si une entrée existe déjà
    const { data, error: selectError } = await supabase
      .from('personalized_support_listing')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single();

    const now = new Date().toISOString();

    if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = not found
      throw selectError;
    }

    if (data) {
      // Mettre à jour l'entrée existante
      const { error } = await supabase
        .from('personalized_support_listing')
        .update({
          is_active: isActive,
          updated_at: now
        })
        .eq('user_id', userId)
        .eq('platform', platform);

      if (error) throw error;
    } else {
      // Créer une nouvelle entrée
      const { error } = await supabase
        .from('personalized_support_listing')
        .insert({
          user_id: userId,
          platform,
          is_active: isActive,
          created_at: now,
          updated_at: now
        });

      if (error) throw error;
    }

    logger.logInfo('PythonProcessor', 'updatePersonalizedSupportStatus', `Updated support status for user ${userId}`, userId, { platform, isActive });
  } catch (error) {
    logger.logError('PythonProcessor', 'updatePersonalizedSupportStatus', error instanceof Error ? error : String(error), userId, { platform, isActive });
    throw error;
  }
}

/**
 * Exécute l'envoi d'un DM via le script Python
 */
async function executeDm(task: PythonTask, workerId: string, customMessage?: string): Promise<Record<string, any>> {
  const endTimer = logger.startPerformanceTimer('PythonProcessor', 'executeDm', task.user_id, { taskId: task.id }, undefined, undefined, workerId);

  try {
    // Vérifier que le payload contient un handle
    if (!task.payload.handle) {
      throw new Error('Missing handle in task payload');
    }
    
    // Chemin vers le script Python selon la plateforme
    const scriptPath = path.resolve(process.cwd(), 
      task.platform === 'bluesky' ? './testDm_bluesky.py' : './testDm_mastodon.py'
    );
    
    // Préparer les arguments pour le script Python
    const args = [task.payload.handle];
    if (customMessage) {
      args.push(customMessage);
    }

    logger.logInfo('PythonProcessor', 'executeDm', `Executing ${task.platform} DM script`, task.user_id, { 
      taskId: task.id
    }, undefined, undefined, workerId);    
    
    // Exécuter le script Python avec les arguments en utilisant l'environnement virtuel
    const pythonExecutable = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : 'python3';
    // console.log(`Sending custom message: ${customMessage}`);
    
    // Utiliser des guillemets doubles pour entourer les arguments et échapper les caractères spéciaux
    const escapedArgs = args.map(arg => `"${arg.replace(/"/g, '\\"')}"`);
    // console.log(`Command: ${pythonExecutable} ${scriptPath} ${escapedArgs.join(' ')}`);
    
    const { stdout, stderr } = await execPromise(`${pythonExecutable} ${scriptPath} ${escapedArgs.join(' ')}`);
    
    // console.log(`🐍 [Python Worker ${workerId}] DM script output:`, stdout);
    endTimer();
    if (stderr && !stdout.includes('Successfully sent DM') && !stdout.includes('Message envoyé avec succès')) {
      // console.error(`❌ [Python Worker ${workerId}] DM script error:`, stderr);
      
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
    console.error(`❌ [Python Worker ${workerId}] Error in executeDm:`, error);
    throw error;
  }
}

/**
 * Crée une nouvelle tâche newsletter programmée pour la semaine suivante
 */
async function scheduleNextNewsletter(task: PythonTask): Promise<void> {
  try {
    // Utiliser la date actuelle si pas de scheduled_for
    const currentDate = task.scheduled_for ? new Date(task.scheduled_for) : new Date();
    const nextScheduledDate = new Date(currentDate);
    nextScheduledDate.setDate(nextScheduledDate.getDate() + 7); // Ajoute 7 jours

    const { error } = await supabase
      .from('python_tasks')
      .insert({
        user_id: task.user_id,
        status: 'pending',
        task_type: 'send-reco-newsletter',
        platform: task.platform,
        scheduled_for: nextScheduledDate.toISOString(),
        payload: task.payload, // Garder le même payload
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    logger.logInfo('PythonProcessor', 'scheduleNextNewsletter', `Scheduled next newsletter for ${nextScheduledDate.toISOString()}`, task.user_id, {
      taskId: task.id,
      platform: task.platform
    });
    } catch (error) {
      logger.logError('PythonProcessor', 'scheduleNextNewsletter', error instanceof Error ? error : String(error), task.user_id, { taskId: task.id });
      throw error;
  }
}

/**
 * Vérifie si une tâche programmée doit être exécutée maintenant
 */
function shouldExecuteScheduledTask(task: PythonTask): boolean {
  if (task.task_type === 'test-dm') return true;
  
  if (task.task_type === 'send-reco-newsletter') {
    if (!task.scheduled_for) return false;
    
    const scheduledTime = new Date(task.scheduled_for);
    const now = new Date();
    
    // Exécuter si l'heure programmée est passée
    return scheduledTime <= now;
  }
  
  return false;
}

/**
 * Récupère les statistiques des utilisateurs qui ne nous suivent pas encore
 */
async function getUnfollowedStats(userId: string): Promise<{ bluesky: number, mastodon: number }> {
  const endTimer = logger.startPerformanceTimer('PythonProcessor', 'getUnfollowedStats', userId);
  logger.logInfo('PythonProcessor', 'getUnfollowedStats', 'Fetching unfollowed stats', userId);

  const PAGE_SIZE = 1000;
  let page = 0;
  let stats = { bluesky: 0, mastodon: 0 };
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase.rpc('get_followable_targets', {
      user_id: userId,
      page_size: PAGE_SIZE,
      page_number: page
    });

    if (error) {
      logger.logError('PythonProcessor', 'getUnfollowedStats', `Failed to get unfollowed stats: ${error.message}`, userId);
      endTimer();
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
      logger.logInfo('PythonProcessor', 'getUnfollowedStats', `End of unfollowed stats`, userId);
      endTimer();
      break;
    }

    // Compter les utilisateurs non suivis sur chaque plateforme
    data.forEach((target: any) => {
      if (target.bluesky_handle && !target.has_follow_bluesky) {
        stats.bluesky++;
      }
      if (target.mastodon_username && !target.has_follow_mastodon) {
        stats.mastodon++;
      }
    });

    page++;
  }

  return stats;
}

/**
 * Récupère la langue préférée de l'utilisateur
 */
async function getUserLanguagePref(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('language_pref')
      .select('language')
      .eq('user_id', userId)
      .single(); // Assumes one preference per user

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      logger.logError('PythonProcessor', 'getUserLanguagePref', `Failed to get language preference: ${error.message}`, userId);
      return 'en'; // Default to English on error
    }

    if (data) {
      // console.log(`🌐 User ${userId} language preference found: ${data.language}`);
      return data.language;
    } else {
      logger.logInfo('PythonProcessor', 'getUserLanguagePref', 'No language preference found, using default', userId);
      return 'en'; // Default to English if no preference found
    }
  } catch (error) {
    logger.logError('PythonProcessor', 'getUserLanguagePref', error instanceof Error ? error : String(error), userId);
    return 'en'; // Default to English on exception
  }
}

/**
 * Traite une tâche Python en fonction de son type
 */
export async function processPythonTask(
  task: PythonTask, 
  workerId: string, 
  allMessages: AllMessages // Ajout du paramètre allMessages
): Promise<void> {
  const taskTimer = logger.startPerformanceTimer('PythonProcessor', 'processPythonTask', task.user_id, { taskId: task.id }, undefined, undefined, workerId);
  logger.logInfo('PythonProcessor', 'processPythonTask', `Processing task ${task.id} (type: ${task.task_type})`, task.user_id, {
    platform: task.platform,
    workerId
  });  
  if (task.scheduled_for && !shouldExecuteScheduledTask(task)) {
    logger.logInfo('PythonProcessor', 'processPythonTask', `Task ${task.id} is scheduled for later`, task.user_id, {
      scheduledFor: task.scheduled_for,
      workerId
    });
    
    // Remettre la tâche en pending pour qu'elle puisse être reprise plus tard
    await updateTaskStatus(task.id, 'pending', null, null);
    taskTimer();
    return;
  }
  try {

    let result: Record<string, any>;
    
    // Récupérer la langue préférée de l'utilisateur au début
    const userLang = await getUserLanguagePref(task.user_id);
    logger.logInfo('PythonProcessor', 'processPythonTask', `Processing with language: ${userLang}`, task.user_id, { workerId });

    // Obtenir les messages pour la langue (avec fallback sur 'en')
    const messages = allMessages[userLang] || allMessages['en'];
    if (!messages) {
        // Ceci ne devrait pas arriver si loadAllMessages dans index.ts garantit un fallback
        logger.logError('PythonProcessor', 'processPythonTask', `Critical: No messages found for lang ${userLang} or fallback 'en'`, task.user_id, { workerId });
        // Gérer l'erreur - peut-être utiliser un message codé en dur ici aussi
        throw new Error(`Missing messages for language ${userLang}`);
    }

    // Exécuter la fonction appropriée selon le type de tâche
    switch (task.task_type) {
      case 'test-dm': { // Use block scope for clarity
        // Utiliser le message de test DM depuis le fichier JSON
        const testMessage = messages.testDm;
        logger.logInfo('PythonProcessor', 'processPythonTask', 'Executing test DM task', task.user_id, { platform: task.platform, workerId });

        result = await executeDm(task, workerId, testMessage);
        await updatePersonalizedSupportStatus(task.user_id, task.platform, result.success);
        break;
      }
        
      case 'send-reco-newsletter': { // Use block scope for clarity
        // Récupérer les stats des utilisateurs non suivis
        const stats = await getUnfollowedStats(task.user_id);
        const platformStats = task.platform === 'bluesky' ? stats.bluesky : stats.mastodon;
        
        // Ne pas envoyer de message s'il n'y a pas de targets à suivre
        if (platformStats === 0) {
          logger.logInfo('PythonProcessor', 'processPythonTask', 'Skipping newsletter task - no targets to follow', task.user_id, {
            platform: task.platform,
            platformStats,
            workerId
          });
          
          // Marquer la tâche comme complétée sans envoyer de message
          result = { 
            success: true, 
            info: 'Skipped - no targets to follow'
          };
          
          // Programmer la prochaine newsletter même si on n'a pas envoyé celle-ci
          await scheduleNextNewsletter(task);
          break;
        }
        
        // Créer le message personnalisé basé sur la langue et les stats
        const platformName = task.platform === 'bluesky' ? 'Bluesky' : 'Mastodon';
        let messageTemplate: string;

        if (platformStats === 1) {
          messageTemplate = messages.recoNewsletter.singular;
        } else {
          messageTemplate = messages.recoNewsletter.plural;
        }

        // Remplacer les placeholders
        const message = messageTemplate
          .replace('${count}', platformStats.toString())
          .replace('${platformName}', platformName);
        
        logger.logInfo('PythonProcessor', 'processPythonTask', 'Executing newsletter task', task.user_id, { 
          platform: task.platform, 
          platformStats, 
          workerId 
        });
        
        result = await executeDm(task, workerId, message);
        await updatePersonalizedSupportStatus(task.user_id, task.platform, result.success);
        
        if (result.success) {
          await scheduleNextNewsletter(task);
        }
        break;
      }
        
      default:
        logger.logError('PythonProcessor', 'processPythonTask', `Unsupported task type: ${task.task_type}`, task.user_id, { workerId });
        throw new Error(`Unsupported task type: ${task.task_type}`);
    }
    
    // Mettre à jour le statut de la tâche
    await updateTaskStatus(
      task.id, 
      result.success ? 'completed' : 'failed',
      result,
      result.success ? null : result.error
    );
    
    logger.logInfo('PythonProcessor', 'processPythonTask', `Task ${result.success ? 'completed' : 'failed'}`, task.user_id, {
      taskId: task.id,
      success: result.success,
      workerId
    });
    
    taskTimer();

  } catch (error) {
    logger.logError('PythonProcessor', 'processPythonTask', error instanceof Error ? error : String(error), task.user_id, {
      taskId: task.id,
      workerId
    });

    // Mettre à jour le statut de support personnalisé en cas d'erreur
    try {
      await updatePersonalizedSupportStatus(task.user_id, task.platform, false);
    } catch (supportError) {
    logger.logError('PythonProcessor', 'processPythonTask', `Failed to update support status: ${String(supportError)}`, task.user_id, {
        taskId: task.id,
        workerId
      });
    }
    
    // Mettre à jour le statut en cas d'erreur
    try {
      await updateTaskStatus(
        task.id,
        'failed',
        null,
        error instanceof Error ? error.message : String(error)
      );
    } catch (updateError) {
      logger.logError('PythonProcessor', 'processPythonTask', `Failed to update task status: ${String(updateError)}`, task.user_id, {
        taskId: task.id,
        workerId
      });
    }
    taskTimer();

  }
}