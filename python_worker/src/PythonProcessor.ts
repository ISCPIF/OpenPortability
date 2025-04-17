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
      console.error(`❌ Error updating task status:`, error);
      throw error;
    }
  } catch (error) {
    console.error(`❌ Error in updateTaskStatus for task ${taskId}:`, error);
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

    console.log(`✅ Updated personalized support status for user ${userId} on ${platform} to ${isActive}`);
  } catch (error) {
    console.error(`❌ Error updating personalized support status for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Exécute l'envoi d'un DM via le script Python
 */
async function executeDm(task: PythonTask, workerId: string, customMessage?: string): Promise<Record<string, any>> {
  try {
    console.log(`🐍 [Python Worker ${workerId}] Executing DM for user ${task.user_id} with handle ${task.payload.handle}`);
    
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
    
    // Exécuter le script Python avec les arguments en utilisant l'environnement virtuel
    const pythonExecutable = process.env.VIRTUAL_ENV ? `${process.env.VIRTUAL_ENV}/bin/python` : 'python3';
    const { stdout, stderr } = await execPromise(`${pythonExecutable} ${scriptPath} ${args.map(arg => `'${arg}'`).join(' ')}`);
    
    console.log(`🐍 [Python Worker ${workerId}] DM script output:`, stdout);
    
    if (stderr && !stdout.includes('Successfully sent DM') && !stdout.includes('Message envoyé avec succès')) {
      console.error(`❌ [Python Worker ${workerId}] DM script error:`, stderr);
      
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
    console.log(`✅ Scheduled next newsletter for user ${task.user_id} at ${nextScheduledDate.toISOString()}`);
  } catch (error) {
    console.error(`❌ Error scheduling next newsletter:`, error);
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
      console.error('Error fetching unfollowed stats:', error);
      break;
    }

    if (!data || data.length === 0) {
      hasMore = false;
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
      console.error(`❌ Error fetching language preference for user ${userId}:`, error);
      return 'en'; // Default to English on error
    }

    if (data) {
      console.log(`🌐 User ${userId} language preference found: ${data.language}`);
      return data.language;
    } else {
      console.log(`🌐 No language preference found for user ${userId}, defaulting to 'en'.`);
      return 'en'; // Default to English if no preference found
    }
  } catch (error) {
    console.error(`❌ Exception fetching language preference for user ${userId}:`, error);
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
  console.log(`🐍 [Python Worker ${workerId}] Processing task ${task.id} of type ${task.task_type}`);
  
  try {
    // Vérifier si la tâche doit être exécutée maintenant
    // if (task.scheduled_for) {
    //   const scheduledHour = new Date(task.scheduled_for);
    //   const now = new Date();
    //   console.log(`⏰ Current time before truncation: ${now.toISOString()}`);
      
    //   // Arrondir les deux dates à l'heure
    //   scheduledHour.setMinutes(0, 0, 0);
    //   now.setMinutes(0, 0, 0);
      
    //   console.log(`⏰ Comparing dates after truncation:`);
    //   console.log(`   - Scheduled hour: ${scheduledHour.toISOString()} (${scheduledHour.getTime()})`);
    //   console.log(`   - Current hour:   ${now.toISOString()} (${now.getTime()})`);
    //   console.log(`   - Difference:     ${(scheduledHour.getTime() - now.getTime()) / 1000 / 60} minutes`);
      
    //   if (scheduledHour > now) {
    //     console.log(`⏰ Task ${task.id} is scheduled for later at ${task.scheduled_for}`);
    //     // Remettre la tâche en pending pour qu'elle puisse être reprise plus tard
    //     await updateTaskStatus(task.id, 'pending', null, null);
    //     return;
    //   } else {
    //     console.log(`⏰ Task ${task.id} should be executed now (original schedule: ${task.scheduled_for})`);
    //   }
    // }

    let result: Record<string, any>;
    
    // Récupérer la langue préférée de l'utilisateur au début
    const userLang = await getUserLanguagePref(task.user_id);
    console.log(`🌐 Processing task for user ${task.user_id} with language: ${userLang}`);

    // Obtenir les messages pour la langue (avec fallback sur 'en')
    const messages = allMessages[userLang] || allMessages['en'];
    if (!messages) {
        // Ceci ne devrait pas arriver si loadAllMessages dans index.ts garantit un fallback
        console.error(`❌ Critical: No messages found for lang ${userLang} or fallback 'en'.`);
        // Gérer l'erreur - peut-être utiliser un message codé en dur ici aussi
        throw new Error(`Missing messages for language ${userLang}`);
    }

    // Exécuter la fonction appropriée selon le type de tâche
    switch (task.task_type) {
      case 'test-dm': { // Use block scope for clarity
        // Utiliser le message de test DM depuis le fichier JSON
        const testMessage = messages.testDm;
        result = await executeDm(task, workerId, testMessage);
        await updatePersonalizedSupportStatus(task.user_id, task.platform, result.success);
        break;
      }
        
      case 'send-reco-newsletter': { // Use block scope for clarity
        // Récupérer les stats des utilisateurs non suivis
        const stats = await getUnfollowedStats(task.user_id);
        const platformStats = task.platform === 'bluesky' ? stats.bluesky : stats.mastodon;
        
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
        
        result = await executeDm(task, workerId, message);
        await updatePersonalizedSupportStatus(task.user_id, task.platform, result.success);
        
        if (result.success) {
          await scheduleNextNewsletter(task);
        }
        break;
      }
        
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
    
    // Mettre à jour le statut de support personnalisé en cas d'erreur
    try {
      await updatePersonalizedSupportStatus(task.user_id, task.platform, false);
    } catch (supportError) {
      console.error(`💥 [Python Worker ${workerId}] Failed to update support status:`, supportError);
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
      console.error(`💥 [Python Worker ${workerId}] Failed to update task status:`, updateError);
    }
  }
}