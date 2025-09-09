// python_worker/src/PythonProcessor.ts
import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as dotenv from 'dotenv';
// import logger from './log_utils';
import redis from './redisClient';

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

const authClient = createClient(supabaseUrl, supabaseKey, {
  // {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: "next-auth"
    },
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
        status,
        result,
        error_log: errorLog,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId);

    if (error) throw error;
  } catch (error) {
    console.log('PythonProcessor', 'updateTaskStatus', `Failed to update task status`, taskId, { status, error });
    throw error;
  }
}

/**
 * Programme manuellement une tâche newsletter (remplace scheduleNextNewsletter)
 */
async function scheduleNewsletterTask(testDmTask: PythonTask): Promise<void> {
  try {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    // Vérifier le statut d'onboarding pour déterminer le statut initial
    const { data: user, error: userError } = await authClient
      .from('users')
      .select('has_onboarded')
      .eq('id', testDmTask.user_id)
      .single();
    
    if (userError) {
      console.warn(`⚠️ Could not fetch user onboarding status for ${testDmTask.user_id}, defaulting to 'waiting'`);
    }
    
    const status = user?.has_onboarded ? 'pending' : 'waiting';
    
    const { error } = await supabase
      .from('python_tasks')
      .insert({
        user_id: testDmTask.user_id,
        status: status,
        task_type: 'send-reco-newsletter',
        platform: testDmTask.platform,
        payload: testDmTask.payload,
        scheduled_for: nextWeek.toISOString()
      });

    if (error) throw error;
    
    console.log(`📅 [PythonProcessor] Scheduled newsletter task for user ${testDmTask.user_id} (status: ${status})`);
    
  } catch (error) {
    console.log('PythonProcessor', 'scheduleNewsletterTask', error instanceof Error ? error : String(error), testDmTask.user_id);
    throw error;
  }
}

/**
 * Exécute l'envoi d'un DM via le script Python approprié
 */
async function executeDm(task: PythonTask, workerId: string, customMessage?: string): Promise<Record<string, any>> {
  
  try {
    const handle = task.payload.handle;
    if (!handle) {
      throw new Error('Missing handle in task payload');
    }

    let scriptPath: string;
    let scriptArgs: string[] = [];

    // Choisir le script selon le type de tâche ET la plateforme
    if (task.task_type === 'test-dm') {
      // Scripts de test DM
      if (task.platform === 'bluesky') {
        scriptPath = path.join(__dirname, '..', 'testDm_bluesky.py');
        scriptArgs = [handle];
      } else if (task.platform === 'mastodon') {
        scriptPath = path.join(__dirname, '..', 'testDm_mastodon.py');
        scriptArgs = [handle];
      } else {
        throw new Error(`Unsupported platform: ${task.platform}`);
      }

      if (customMessage) {
        scriptArgs.push(customMessage);
      }
    } else if (task.task_type === 'send-reco-newsletter') {
      // Pour les newsletters, on utilise aussi les scripts de test DM avec le message personnalisé
      if (task.platform === 'bluesky') {
        scriptPath = path.join(__dirname, '..', 'testDm_bluesky.py');
        scriptArgs = [handle];
      } else if (task.platform === 'mastodon') {
        scriptPath = path.join(__dirname, '..', 'testDm_mastodon.py');
        scriptArgs = [handle];
      } else {
        throw new Error(`Unsupported platform: ${task.platform}`);
      }

      if (customMessage) {
        scriptArgs.push(customMessage);
      }
    } else {
      throw new Error(`Unsupported task type: ${task.task_type}`);
    }

    const command = `python3 "${scriptPath}" ${scriptArgs.map(arg => `"${arg}"`).join(' ')}`;
    console.log(`🐍 [PythonProcessor] Executing: ${command}`);

    const timeout = task.task_type === 'send-reco-newsletter' ? 60000 : 30000; // Newsletter plus long
    const { stdout, stderr } = await execPromise(command, {
      timeout,
      env: { ...process.env }
    });

    if (stderr && stderr.trim()) {
      console.warn(`⚠️ [PythonProcessor] Python script stderr: ${stderr}`);
    }

    let result;
    try {
      // Extract JSON from stdout - look for the last line that looks like JSON
      const lines = stdout.trim().split('\n');
      let jsonLine = '';
      
      // Find the last line that starts with '{' and ends with '}'
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.endsWith('}')) {
          jsonLine = line;
          break;
        }
      }
      
      if (!jsonLine) {
        throw new Error(`No JSON found in script output: ${stdout}`);
      }
      
      result = JSON.parse(jsonLine);
    } catch (parseError) {
      // Si le parsing JSON échoue, considérer la sortie comme un message d'erreur
      throw new Error(`Script output is not valid JSON: ${stdout}`);
    }

    if (result.success) {
      console.log(`✅ [PythonProcessor] ${task.task_type} sent successfully to ${handle} on ${task.platform}`);
    } else {
      throw new Error(result.error || 'Unknown error from Python script');
    }
    return result;

  } catch (error) {
    console.log('PythonProcessor', 'executeDm', error instanceof Error ? error : String(error), task.user_id, { platform: task.platform, handle: task.payload.handle }, undefined, undefined, workerId);
    throw error;
  }
}

/**
 * Vérifie si une tâche programmée doit être exécutée maintenant
 */
function shouldExecuteScheduledTask(task: PythonTask): boolean {
  if (!task.scheduled_for) {
    return true; // Pas de programmation, exécuter immédiatement
  }

  const scheduledTime = new Date(task.scheduled_for);
  const now = new Date();
  
  const shouldExecute = now >= scheduledTime;
  
  if (!shouldExecute) {
    console.log(`⏰ [PythonProcessor] Task ${task.id} scheduled for ${scheduledTime.toISOString()}, current time: ${now.toISOString()}`);
  }
  
  return shouldExecute;
}

/**
 * Version worker de getFollowableTargetsFromRedis pour les stats
 */
async function getUnfollowedStatsFromRedis(userId: string): Promise<{ bluesky: number, mastodon: number }> {
  
  try {
    // 1. Récupérer les sources_targets non suivis
    const { data: sourcesTargets, error } = await supabase
      .from('sources_targets')
      .select('target_twitter_id, has_follow_bluesky, has_follow_mastodon, dismissed')
      .eq('source_id', userId)
      .or('has_follow_bluesky.eq.false,has_follow_mastodon.eq.false')
      .eq('dismissed', false); // Seulement les non-ignorés

    if (error || !sourcesTargets) {
      console.warn(`⚠️ [PythonProcessor] Could not fetch sources_targets for user ${userId}: ${error?.message}`);
      return { bluesky: 0, mastodon: 0 };
    }

    if (sourcesTargets.length === 0) {
      console.log(`📊 [PythonProcessor] No unfollowed targets found for user ${userId}`);
      return { bluesky: 0, mastodon: 0 };
    }

    console.log("data retrieved sources_targets retrieved from db :", sourcesTargets.length);

    // 2. Récupérer les mappings depuis Redis
    const twitterIds = sourcesTargets.map(st => st.target_twitter_id);

    console.log("twitterIds", twitterIds.length)
    const mappings = await redis.batchGetSocialMappings(twitterIds);

    console.log("mappings", mappings.size)
    

    // 3. Compter les correspondances non suivies
    let stats = { bluesky: 0, mastodon: 0 };

    for (const sourceTarget of sourcesTargets) {
      const mapping = mappings.get(sourceTarget.target_twitter_id);
      
      if (mapping) {
        console.log("we have a mapping for", sourceTarget.target_twitter_id)
        console.log(sourceTarget)
        console.log(mapping)
        // Compter Bluesky si correspondance existe et pas encore suivi
        if (mapping.bluesky) {
          stats.bluesky++;
        }
        
        // Compter Mastodon si correspondance existe et pas encore suivi
        if (mapping.mastodon) {
          console.log("mastodon stats = ", stats.mastodon)
          stats.mastodon++;
        }
      }
    }

    console.log(`📊 [PythonProcessor] Unfollowed stats for user ${userId}: ${stats.bluesky} Bluesky, ${stats.mastodon} Mastodon`);
    return stats;
    
  } catch (error) {
    console.log('PythonProcessor', 'getUnfollowedStatsFromRedis', error instanceof Error ? error : String(error), userId);
    return { bluesky: 0, mastodon: 0 };
  }
}

/**
 * Récupère la langue préférée de l'utilisateur
 */
async function getUserLanguagePref(userId: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('language_preference')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.warn(`⚠️ [PythonProcessor] Could not fetch language preference for user ${userId}, defaulting to 'en'`);
      return 'en';
    }

    return data.language_preference || 'en';
  } catch (error) {
    console.log('PythonProcessor', 'getUserLanguagePref', error instanceof Error ? error : String(error), userId);
    return 'en';
  }
}

/**
 * Traite une tâche Python en fonction de son type
 */
export async function processPythonTask(
  task: PythonTask, 
  workerId: string, 
  allMessages: AllMessages
): Promise<void> {
  
  try {
    console.log(`🔄 [PythonProcessor] Processing task ${task.id} (type: ${task.task_type}, platform: ${task.platform})`);

    // Vérifier si la tâche doit être exécutée maintenant (pour les tâches programmées)
    if (!shouldExecuteScheduledTask(task)) {
      console.log(`⏰ [PythonProcessor] Task ${task.id} is scheduled for later, skipping`);
      // Remettre la tâche en pending pour qu'elle soit récupérée plus tard
      await updateTaskStatus(task.id, 'pending');
      return;
    }

    let result: Record<string, any>;

    if (task.task_type === 'test-dm') {
      // Traiter le test DM
      console.log(`🧪 [PythonProcessor] Processing test DM for ${task.payload.handle} on ${task.platform}`);
      
      // Récupérer le message de test dans la langue de l'utilisateur
      const userLang = await getUserLanguagePref(task.user_id);
      const testMessage = allMessages[userLang]?.testDm || allMessages['en']?.testDm || 'Test message';
      
      result = await executeDm(task, workerId, testMessage);
      
      // Si succès, programmer manuellement la tâche newsletter
      if (result.success) {
        await scheduleNewsletterTask(task);
        console.log(`✅ [PythonProcessor] Test DM successful, newsletter scheduled for user ${task.user_id}`);
      }
      
    } else if (task.task_type === 'send-reco-newsletter') {
      // Traiter l'envoi de newsletter
      console.log(`📧 [PythonProcessor] Processing newsletter for ${task.payload.handle} on ${task.platform}`);
      
      // Récupérer les stats des utilisateurs non suivis
      const stats = await getUnfollowedStatsFromRedis(task.user_id);
      const platformStats = task.platform === 'bluesky' ? stats.bluesky : stats.mastodon;
      
      // Ne pas envoyer de message s'il n'y a pas de targets à suivre
      if (platformStats === 0) {
        console.log('PythonProcessor', 'processPythonTask', 'Skipping newsletter task - no targets to follow', task.user_id, {
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
        await scheduleNewsletterTask(task);
      } else {
        // Récupérer la langue de l'utilisateur
        const userLang = await getUserLanguagePref(task.user_id);
        const messages = allMessages[userLang] || allMessages['en'];
        
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
        
        console.log('PythonProcessor', 'processPythonTask', 'Executing newsletter task', task.user_id, { 
          platform: task.platform, 
          platformStats, 
          workerId 
        });
        
        result = await executeDm(task, workerId, message);
        
        if (result.success) {
          await scheduleNewsletterTask(task);
        }
      }
    } else {
      throw new Error(`Unknown task type: ${task.task_type}`);
    }

    // Mettre à jour le statut de la tâche
    await updateTaskStatus(
      task.id, 
      result.success ? 'completed' : 'failed',
      result,
      result.success ? null : result.error
    );


  } catch (error) {
    console.log('PythonProcessor', 'processPythonTask', error instanceof Error ? error : String(error), task.user_id, { 
      taskId: task.id, 
      taskType: task.task_type, 
      platform: task.platform 
    }, undefined, undefined, workerId);
    
    // Mettre à jour le statut en cas d'erreur
    try {
      await updateTaskStatus(
        task.id,
        'failed',
        null,
        error instanceof Error ? error.message : String(error)
      );
    } catch (updateError) {
      console.error(`❌ [PythonProcessor] Failed to update task status: ${updateError}`);
    }
  }
}