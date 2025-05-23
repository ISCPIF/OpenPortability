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
    // console.log(' [UserRepository.getUserActiveConsents] Querying DB for user:', userId);
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

    // console.log(' [UserRepository.getUserActiveConsents] Raw DB results:', data);

    // Transformer les résultats en objet
    const consents: Record<string, boolean> = {};
    data?.forEach(item => {
      consents[item.consent_type] = item.consent_value;
    });
    
    // console.log(' [UserRepository.getUserActiveConsents] Transformed consents:', consents);
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
    const { error } = await supabase
      .from('newsletter_consents')
      .insert({
        user_id: userId,
        consent_type: type,
        consent_value: value,
        ip_address: metadata?.ip_address,
        user_agent: metadata?.user_agent
      });

    if (error) {
      logError('Repository', 'UserRepository.updateConsent', error, userId);
      throw error;
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

    console.log(' [UserRepository.insertNewsletterConsent] Inserting consent:', consentType, consentValue);
    // Insérer le nouveau consentement (le trigger deactivate_previous_consents gérera la désactivation)
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
    const { data, error } = await supabase
      .from('language_pref')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      logError('Repository', 'UserRepository.getUserLanguagePreference', error, userId);
      throw error;
    }
    
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
}