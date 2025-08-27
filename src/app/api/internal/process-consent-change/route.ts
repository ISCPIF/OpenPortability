import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase, authClient } from '@/lib/supabase';
import { redis } from '@/lib/redis';
import { UserRepository } from '@/lib/repositories/userRepository';
import { withInternalValidation } from '@/lib/validation/internal-middleware';

// Schéma de validation pour le payload du trigger
const ConsentChangeSchema = z.object({
  user_id: z.string().uuid(),
  consent_type: z.enum(['bluesky_dm', 'mastodon_dm', 'email_newsletter', 'oep_newsletter', 'research_participation']),
  consent_value: z.boolean(),
  old_consent_value: z.boolean().optional().nullable(),
  handle: z.string().optional().nullable(), // Handle pour bluesky_dm/mastodon_dm
  metadata: z.object({
    userAgent: z.string().optional().nullable(),
    ip: z.string().optional().nullable(),
    trigger_operation: z.enum(['INSERT', 'UPDATE']),
    timestamp: z.string()
  })
});

// Instance du repository
const userRepository = new UserRepository();

/**
 * Handler principal pour traiter les changements de consent
 */
async function handleConsentChange(
  request: NextRequest,
  validatedData: z.infer<typeof ConsentChangeSchema>
): Promise<NextResponse> {
  try {
    const { user_id, consent_type, consent_value, handle, metadata } = validatedData;

    console.log(` [process-consent-change] Processing ${consent_type} = ${consent_value} for user ${user_id}`);

    // Router selon le type de consent
    switch (consent_type) {
      case 'bluesky_dm':
      case 'mastodon_dm':
        await handlePlatformDMConsent(user_id, consent_type, consent_value, handle, metadata);
        break;
        
      case 'email_newsletter':
        await handleEmailNewsletterConsent(user_id, consent_value, metadata);
        break;
        
      default:
        console.log(` [process-consent-change] Unknown consent type: ${consent_type}`);
    }

    console.log(` [process-consent-change] Successfully processed ${consent_type} for user ${user_id}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error(' [process-consent-change] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process consent change' },
      { status: 500 }
    );
  }
}

// Export du POST wrappé avec le middleware de validation interne
export const POST = withInternalValidation(
  ConsentChangeSchema,
  handleConsentChange,
  {
    disableInDev: true,        // Désactivé en dev pour faciliter les tests
    requireSignature: true,    // Signature HMAC requise
    logSecurityEvents: true,   // Logs de sécurité activés
    allowEmptyBody: false      // Body requis pour cet endpoint
  }
);

/**
 * Gère les consents de DM pour les plateformes (bluesky_dm, mastodon_dm)
 */
async function handlePlatformDMConsent(
  userId: string,
  consentType: 'bluesky_dm' | 'mastodon_dm',
  consentValue: boolean,
  handle: string | null | undefined,
  metadata: any
) {
  const platform = consentType === 'bluesky_dm' ? 'bluesky' : 'mastodon';
  
  if (consentValue) {
    // Consent activé
    if (handle) {
      // Handle disponible → Tâche 'pending' avec payload (DB + Redis)
      await createTestDMTask(userId, platform, handle, metadata);
      console.log(` [handlePlatformDMConsent] Created pending test-dm task for ${platform}: ${handle}`);
    } else {
      // Pas de handle → Tâche 'waiting' sans payload (DB seulement)
      await createWaitingTestDMTask(userId, platform, metadata);
      console.log(` [handlePlatformDMConsent] Created waiting test-dm task for ${platform} (no handle yet)`);
    }
    
  } else {
    // Consent désactivé → Supprimer tâches en attente (pending ET waiting)
    await userRepository.deletePendingPythonTasks(userId, platform);
    await deleteWaitingPythonTasks(userId, platform);
    console.log(` [handlePlatformDMConsent] Deleted pending and waiting tasks for ${platform}`);
  }
}

/**
 * Gère le consent email_newsletter
 */
async function handleEmailNewsletterConsent(
  userId: string,
  consentValue: boolean,
  metadata: any
) {
  try {
    if (consentValue) {
      // Récupérer l'email de l'utilisateur
      const { data: user } = await authClient
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (!user?.email) {
        console.error(` [handleEmailNewsletterConsent] No email found for user ${userId}`);
        return;
      }

      // Insérer dans newsletter_listing
      await supabase
        .from('newsletter_listing')
        .upsert({
          user_id: userId,
          email: user.email,
          created_at: new Date().toISOString()
        });
        
      console.log(` [handleEmailNewsletterConsent] Added to newsletter_listing: ${user.email}`);
      
    } else {
      // Supprimer de newsletter_listing
      await supabase
        .from('newsletter_listing')
        .delete()
        .eq('user_id', userId);
        
      console.log(` [handleEmailNewsletterConsent] Removed from newsletter_listing`);
    }
  } catch (error) {
    console.error(` [handleEmailNewsletterConsent] Error:`, error);
    throw error;
  }
}

/**
 * Crée une tâche test-dm dans python_tasks ET Redis
 */
async function createTestDMTask(
  userId: string,
  platform: 'bluesky' | 'mastodon',
  handle: string,
  metadata: any
) {
  try {
    // 1. Vérifier s'il existe déjà une tâche pending pour éviter les doublons
    const { data: existingTask } = await supabase
      .from('python_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('task_type', 'test-dm')
      .eq('status', 'pending')
      .single();

    if (existingTask) {
      console.log(` [createTestDMTask] Task already exists for ${userId}:${platform}, skipping`);
      return;
    }

    // 2. Créer la tâche dans python_tasks
    const taskPayload = { handle };
    
    const { data: newTask, error: dbError } = await supabase
      .from('python_tasks')
      .insert({
        user_id: userId,
        status: 'pending',
        task_type: 'test-dm',
        platform: platform,
        payload: taskPayload
      })
      .select('id')
      .single();

    if (dbError) {
      console.error(` [createTestDMTask] DB error:`, dbError);
      throw dbError;
    }

    console.log(` [createTestDMTask] Created python_task ${newTask.id} for ${platform}`);

    // 3. Ajouter à Redis (avec fallback si Redis est down)
    try {
      await addTaskToRedis(userId, platform, handle, newTask.id);
      console.log(` [createTestDMTask] Added to Redis queue for ${platform}`);
    } catch (redisError) {
      console.error(` [createTestDMTask] Redis error (task still created in DB):`, redisError);
      // Ne pas throw - la tâche existe dans python_tasks, le worker peut la récupérer
    }

  } catch (error) {
    console.error(` [createTestDMTask] Error for ${platform}:`, error);
    throw error;
  }
}

/**
 * Crée une tâche test-dm dans python_tasks (status 'waiting')
 */
async function createWaitingTestDMTask(
  userId: string,
  platform: 'bluesky' | 'mastodon',
  metadata: any
) {
  try {
    // 1. Vérifier s'il existe déjà une tâche waiting pour éviter les doublons
    const { data: existingTask } = await supabase
      .from('python_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('task_type', 'test-dm')
      .eq('status', 'waiting')
      .single();

    if (existingTask) {
      console.log(` [createWaitingTestDMTask] Task already exists for ${userId}:${platform}, skipping`);
      return;
    }

    // 2. Créer la tâche dans python_tasks
    const { data: newTask, error: dbError } = await supabase
      .from('python_tasks')
      .insert({
        user_id: userId,
        status: 'waiting',
        task_type: 'test-dm',
        platform: platform
      })
      .select('id')
      .single();

    if (dbError) {
      console.error(` [createWaitingTestDMTask] DB error:`, dbError);
      throw dbError;
    }

    console.log(` [createWaitingTestDMTask] Created python_task ${newTask.id} for ${platform}`);

  } catch (error) {
    console.error(` [createWaitingTestDMTask] Error for ${platform}:`, error);
    throw error;
  }
}

/**
 * Ajoute une tâche à Redis avec déduplication
 */
async function addTaskToRedis(
  userId: string,
  platform: 'bluesky' | 'mastodon',
  handle: string,
  taskId: string
) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const queueKey = `consent_tasks:${today}`;
  const dedupeKey = `task_dedup:${userId}:${platform}:test-dm`;

  // Vérifier déduplication
  const existingTask = await redis.get(dedupeKey);
  if (existingTask) {
    console.log(` [addTaskToRedis] Task already in Redis for ${userId}:${platform}, skipping`);
    return;
  }

  const taskData = {
    id: taskId,
    user_id: userId,
    task_type: 'test-dm',
    platform: platform,
    handle: handle,
    created_at: new Date().toISOString(),
    status: 'pending'
  };

  // Ajouter à la queue Redis
  await redis.lpush(queueKey, JSON.stringify(taskData));
  
  // Marquer comme traité pour déduplication (expire après 1 heure)
  await redis.setex(dedupeKey, 3600, JSON.stringify(taskData));
}

/**
 * Supprime les tâches Python en attente pour une plateforme
 */
async function deletePendingPythonTasks(userId: string, platform: 'bluesky' | 'mastodon') {
  try {
    // Supprimer de python_tasks
    const { error } = await supabase
      .from('python_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform)
      .in('status', ['pending', 'waiting']);

    if (error) {
      console.error(` [deletePendingPythonTasks] DB error:`, error);
      throw error;
    }

    // TODO: Nettoyer Redis si nécessaire (optionnel)
    
    console.log(` [deletePendingPythonTasks] Deleted pending tasks for ${platform}`);
    
  } catch (error) {
    console.error(` [deletePendingPythonTasks] Error for ${platform}:`, error);
    throw error;
  }
}

/**
 * Supprime les tâches Python en attente pour une plateforme
 */
async function deleteWaitingPythonTasks(userId: string, platform: 'bluesky' | 'mastodon') {
  try {
    // Supprimer de python_tasks
    const { error } = await supabase
      .from('python_tasks')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'waiting');

    if (error) {
      console.error(` [deleteWaitingPythonTasks] DB error:`, error);
      throw error;
    }

    console.log(` [deleteWaitingPythonTasks] Deleted waiting tasks for ${platform}`);
    
  } catch (error) {
    console.error(` [deleteWaitingPythonTasks] Error for ${platform}:`, error);
    throw error;
  }
}