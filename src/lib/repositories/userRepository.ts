import { UserUpdate, ShareEvent } from '../types/user';
import { SupabaseClient } from '@supabase/supabase-js';
import { authClient, supabase } from '../supabase';
import { logError, logWarning } from '../log_utils';

export class UserRepository {
    
  async updateUser(userId: string, update: UserUpdate): Promise<void> {
    const { error } = await authClient
      .from('users')
      .update(update)
      .eq('id', userId);
    
    if (error) {
      logError('Repository', 'UserRepository.updateUser', error, userId, { update });
      throw error;
    }
  }

  async getUser(userId: string) {
    const { data, error } = await authClient
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      logError('Repository', 'UserRepository.getUser', error, userId);
      throw error;
    }
    return data;
  }

  async createShareEvent(event: ShareEvent): Promise<void> {
    const { error } = await supabase
      .from('share_events')
      .insert(event);
    
    if (error) {
      logError('Repository', 'UserRepository.createShareEvent', error, event.source_id, { event });
      throw error;
    }
  }

  async getShareEvents(userId: string): Promise<ShareEvent[]> {
    const { data, error } = await supabase
      .from('share_events')
      .select('*')
      .eq('source_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) { 
      logError('Repository', 'UserRepository.getShareEvents', error, userId);
      throw error;
    }
    return data || [];
  }

  async hasShareEvents(userId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from('share_events')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', userId);
    
    if (error) {
      logError('Repository', 'UserRepository.hasShareEvents', error, userId);
      throw error;
    }
    
    return count !== null && count > 0;
  }

  /**
   * Récupère tous les consentements actifs d'un utilisateur
   * 
   * @param userId Identifiant de l'utilisateur
   * @returns Un objet avec les types de consentement comme clés et les valeurs de consentement comme valeurs
   */
  async getUserActiveConsents(userId: string): Promise<Record<string, boolean>> {
    const { data, error } = await supabase
      .from('newsletter_consents')
      .select('consent_type, consent_value')
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (error) {
      console.error(' [UserRepository.getUserActiveConsents] DB Error:', error);
      logError('Repository', 'UserRepository.getUserActiveConsents', error, userId);
      throw error;
    }


    // Transformer les résultats en objet
    const consents: Record<string, boolean> = {};
    data?.forEach((item: any) => {
      consents[item.consent_type] = item.consent_value;
    });
    
    return consents;
  }

  /**
   * Récupère l'historique des consentements d'un utilisateur pour un type de consentement donné
   * 
   * @param userId Identifiant de l'utilisateur
   * @param consentType Type de consentement (ou undefined pour récupérer tous les types)
   * @returns Tableau d'historique des consentements
   */
  async getConsentHistory(
    userId: string, 
    consentType?: string
  ): Promise<Array<{
    consent_type: string;
    consent_value: boolean;
    consent_timestamp: string;
    is_active: boolean;
  }>> {
    let query = supabase
      .from('newsletter_consents')
      .select('consent_type, consent_value, consent_timestamp, is_active')
      .eq('user_id', userId)
      .order('consent_timestamp', { ascending: false });
    
    // Filtrer par type de consentement si spécifié
    if (consentType) {
      query = query.eq('consent_type', consentType);
    }
    
    const { data, error } = await query;
    
    if (error) {
      logError('Repository', 'UserRepository.getConsentHistory', error, userId, { consentType });
      throw error;
    }
    
    return data || [];
  }

  /**
   * Met à jour un consentement spécifique pour un utilisateur
   */
  async updateConsent(
    userId: string, 
    type: string, 
    value: boolean,
    metadata?: {
      ip_address?: string;
      user_agent?: string;
    }
  ): Promise<void> {
    try {
      // Process IP addresses
      let firstIpAddress = null;
      let fullIpAddressChain = null;
      
      if (metadata?.ip_address) {
        // Store the full IP chain for forensic purposes
        fullIpAddressChain = metadata.ip_address;
        
        // Extract just the first IP for the inet column
        const ips = metadata.ip_address.split(',').map(ip => ip.trim()).filter(Boolean);
        if (ips.length > 0) {
          firstIpAddress = ips[0];
        }
      }

      const { error } = await supabase.rpc('update_user_consent', {
        p_user_id: userId,
        p_consent_type: type,
        p_consent_value: value,
        p_ip_address: firstIpAddress,
        p_user_agent: metadata?.user_agent || null,
        p_ip_address_full: fullIpAddressChain
      });

      if (error) {
        // Check if this is a unique constraint violation (race condition)
        if (error.code === '23505' && error.message?.includes('unique_active_consent')) {
          // This is likely a race condition where another request already created the consent
          // Log as warning instead of error since the consent was still recorded
          logWarning(
            'Repository', 
            'UserRepository.updateConsent', 
            `Ignoring duplicate consent update: ${error.message}`, 
            userId
          );
          return; // Return success since the consent is already recorded
        }
        
        // For other errors, log and throw as usual
        logError('Repository', 'UserRepository.updateConsent', error, userId);
        throw error;
      }
    } catch (error) {
      // Only re-throw if it's not already handled above
      if (!((error as any)?.code === '23505')) {
        logError('Repository', 'UserRepository.updateConsent', error as Error, userId);
        throw error;
      }
    }
  }
  /**
   * Insère un nouveau consentement et désactive les précédents consentements du même type
   * 
   * @param userId Identifiant de l'utilisateur
   * @param consentType Type de consentement (email_newsletter, bluesky_dm, etc.)
   * @param consentValue Valeur du consentement (true/false)
   * @param metadata Métadonnées additionnelles à stocker (user-agent, etc.)
   * @returns Le consentement créé
   */
  async insertNewsletterConsent(
    userId: string,
    consentType: string,
    consentValue: boolean,
    metadata: Record<string, any> = {}
  ): Promise<any> {

    const { data, error } = await supabase
      .from('newsletter_consents')
      .insert({
        user_id: userId,
        consent_type: consentType,
        consent_value: consentValue,
        consent_timestamp: new Date().toISOString(),
        user_agent: metadata?.userAgent || null,
        ip_address: metadata?.ip || null,
        is_active: true
      })
      .select()
      .single();
    
    if (error) {
      logError('Repository', 'UserRepository.insertNewsletterConsent', error, userId, {
        consentType,
        consentValue,
        operation: 'insert'
      });
      throw error;
    }
    
    return data;
  }

  async updateNewsletterConsent(
    userId: string,
    email: string | null,
    value: boolean,
    metadata: any
  ): Promise<void> {
    const { data, error } = await supabase
      .from('newsletter_consents')
      .upsert({
        user_id: userId,
        consent_type: 'email_newsletter',
        consent_value: value,
        ip_address: metadata.ip_address,
        user_agent: metadata.user_agent
      });

    if (error) {
      logError('Repository', 'UserRepository.updateNewsletterConsent', error);
      throw error;
    }

    // Si un email est fourni, mettre à jour l'email de l'utilisateur
    if (email) {
      const { error: emailError } = await authClient
        .from('users')
        .update({ email })
        .eq('id', userId);

      if (emailError) {
        logError('Repository', 'UserRepository.updateNewsletterConsent', emailError);
        throw emailError;
      }
    }
  }

  async getUserLanguagePreference(userId: string) {
    const { data } = await supabase
      .from('language_pref')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    // if (error) {
    //   logError('Repository', 'UserRepository.getUserLanguagePreference', error, userId);
    //   throw error;
    // }
    
    return data;
  }

  async updateLanguagePreference(
    userId: string,
    language: string,
  ): Promise<void> {
    const { error } = await supabase
      .from('language_pref')
      .upsert({
        user_id: userId,
        language,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      logError('Repository', 'UserRepository.updateLanguagePreference', error, userId);
      throw error;
    }
  }

  /**
   * Supprime les tâches Python en attente pour un utilisateur
   * 
   * @param userId Identifiant de l'utilisateur
   * @param platform Plateforme spécifique (optionnel)
   * @param taskType Type de tâche spécifique (optionnel)
   */
  async deletePendingPythonTasks(
    userId: string, 
    platform?: 'bluesky' | 'mastodon',
    taskType?: string
  ): Promise<void> {
    let query = supabase
      .from('python_tasks')
      .delete()
      .eq('user_id', userId)
      .in('status', ['pending', 'waiting']);

    if (platform) {
      query = query.eq('platform', platform);
    }

    if (taskType) {
      query = query.eq('task_type', taskType);
    }

    const { error } = await query;
    
    if (error) {
      logError('Repository', 'UserRepository.deletePendingPythonTasks', error, userId, { platform, taskType });
      throw error;
    }

    // Nettoyer Redis quand on supprime des tâches
    await this.cleanupRedisForDeletedTasks(userId, platform, taskType);
  }

  /**
   * Nettoie Redis lors de la suppression de tâches Python
   * Supprime les clés de déduplication et optionnellement les tâches de la queue
   */
  private async cleanupRedisForDeletedTasks(
    userId: string,
    platform?: 'bluesky' | 'mastodon', 
    taskType?: string
  ): Promise<void> {
    try {
      const { redis } = await import('@/lib/redis');
      
      // 1. Supprimer les clés de déduplication
      if (platform && taskType) {
        const dedupKey = `task_dedup:${userId}:${platform}:${taskType}`;
        await redis.del(dedupKey);
      }
      else if (platform) {
        const pattern = `task_dedup:${userId}:${platform}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.redisClient.del(...keys);
        }
      }
      else {
        const pattern = `task_dedup:${userId}:*`;
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.redisClient.del(...keys);
        }
      }

      // 2. Supprimer les tâches de la queue Redis
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const queueKey = `consent_tasks:${today}`;
      
      // Récupérer toutes les tâches de la queue
      const queueTasks = await redis.lrange(queueKey, 0, -1);
      let removedCount = 0;
      
      for (const taskJson of queueTasks) {
        try {
          const task = JSON.parse(taskJson);
          
          // Vérifier si cette tâche correspond aux critères de suppression
          let shouldRemove = false;
          
          if (task.user_id === userId) {
            if (platform && taskType) {
              // Suppression spécifique : user + platform + taskType
              shouldRemove = task.platform === platform && task.task_type === taskType;
            } else if (platform) {
              // Suppression par platform : user + platform
              shouldRemove = task.platform === platform;
            } else {
              // Suppression générale : tous les tasks de cet user
              shouldRemove = true;
            }
          }
          
          if (shouldRemove) {
            // Note: Redis LREM supprime toutes les occurrences de cette valeur exacte
            await redis.lrem(queueKey, 0, taskJson);
            removedCount++;
          }
        } catch (parseError) {
          console.warn(`⚠️ [cleanupRedisForDeletedTasks] Failed to parse task JSON: ${taskJson}`);
        }
      }
      
      if (removedCount > 0) {
      }

    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logError('Repository', 'UserRepository.cleanupRedisForDeletedTasks', errorString, userId, { platform, taskType });
      // Ne pas faire échouer la suppression des tâches DB si Redis échoue
    }
  }

  /**
   * Insère un utilisateur dans newsletter_listing
   * 
   * @param userId Identifiant de l'utilisateur
   */
  async insertNewsletterListing(userId: string): Promise<void> {
    // Récupérer l'email de l'utilisateur
    const user = await this.getUser(userId);
    if (!user || !user.email) {
      throw new Error('User not found or email missing');
    }

    const { error } = await supabase
      .from('newsletter_listing')
      .insert({ 
        user_id: userId,
        email: user.email
      });
    
    if (error) {
      // Ignorer les erreurs de conflit (utilisateur déjà présent)
      if (error.code !== '23505') { // unique_violation
        logError('Repository', 'UserRepository.insertNewsletterListing', error, userId);
        throw error;
      }
    }
  }

  /**
   * Supprime un utilisateur de newsletter_listing
   * 
   * @param userId Identifiant de l'utilisateur
   */
  async deleteNewsletterListing(userId: string): Promise<void> {
    const { error } = await supabase
      .from('newsletter_listing')
      .delete()
      .eq('user_id', userId);
    
    if (error) {
      logError('Repository', 'UserRepository.deleteNewsletterListing', error, userId);
      throw error;
    }
  }
}