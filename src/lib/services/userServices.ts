import { UserRepository } from '@/lib/repositories/userRepository';
import { redis } from '@/lib/redis';
import { NewsletterUpdate, ShareEvent, User } from '../types/user';
import { isValidEmail } from '../utils';

export class UserService {
  private repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
  }

  async updatePreferencesNewsletter(userId: string, data: {
    email?: string;
    acceptHQX?: boolean;
    acceptOEP?: boolean;
    research_accepted?: boolean;
    personalized_support?: boolean;
  }): Promise<void> {
    const update: NewsletterUpdate = {
      have_seen_newsletter: true
    };

    if (data.email) {
      if (!isValidEmail(data.email)) {
        throw new Error('Invalid email format');
      }
      update.email = data.email.trim().toLowerCase();
    }

    // Handle all boolean fields explicitly
    if (typeof data.acceptHQX !== 'undefined') {
      update.hqx_newsletter = data.acceptHQX;
    }

    if (typeof data.acceptOEP !== 'undefined') {
      update.oep_accepted = data.acceptOEP;
    }

    if (typeof data.research_accepted !== 'undefined') {
      update.research_accepted = data.research_accepted;
    }

    if (typeof data.personalized_support !== 'undefined') {
      update.personalized_support = data.personalized_support;
    }

    await this.repository.updateUser(userId, update);
  }

  /**
   * Met à jour l'email d'un utilisateur dans next-auth.users
   */
  async updateEmail(userId: string, email: string): Promise<void> {
    if (!email) {
      throw new Error('Email is required');
    }
    await this.repository.updateUser(userId, { email });
  }

  /**
   * Met à jour le statut have_seen_newsletter d'un utilisateur
   */
  async updateHaveSeenNewsletter(userId: string): Promise<void> {
    await this.repository.updateUser(userId, {
      have_seen_newsletter: true
    });
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
    await this.repository.updateConsent(userId, type, value, metadata);
  }

  /**
   * Récupère les préférences newsletter d'un utilisateur
   */
  async getNewsletterPreferences(userId: string): Promise<{
    email?: string;
    hqx_newsletter: boolean;
    oep_accepted: boolean;
    research_accepted: boolean;
    // have_seen_newsletter: boolean;
  }> {
    console.log('🔍 [UserService.getNewsletterPreferences] Getting preferences for user:', userId);
    try {
      // Récupérer l'email de l'utilisateur et have_seen_newsletter
      const user = await this.repository.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Récupérer les consentements actifs
      const activeConsents = await this.repository.getUserActiveConsents(userId);
      
      console.log('✅ [UserService.getNewsletterPreferences] Got preferences:', {
        email: user.email,
        hqx_newsletter: activeConsents['email_newsletter'] || false,
        oep_accepted: activeConsents['oep_newsletter'] || false,
        research_accepted: activeConsents['research_participation'] || false,
        // have_seen_newsletter: user.have_seen_newsletter
      });

      return {
        email: user.email,
        hqx_newsletter: activeConsents['email_newsletter'] || false,
        oep_accepted: activeConsents['oep_newsletter'] || false,
        research_accepted: activeConsents['research_participation'] || false,
        // have_seen_newsletter: user.have_seen_newsletter
      };
    } catch (error) {
      console.error('❌ [UserService.getNewsletterPreferences] Error:', error);
      throw error;
    }
  }

  async recordShareEvent(userId: string, platform: string, success: boolean): Promise<void> {
    const event: ShareEvent = {
      source_id: userId,
      platform,
      success,
      shared_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    try {
      await this.repository.createShareEvent(event);
      console.log(`Share event recorded for user ${userId} on platform ${platform}`);
    } catch (error) {
      console.error('Failed to record share event:', error);
      throw error;
    }
  }

  async getUserShareEvents(userId: string): Promise<ShareEvent[]> {
    try {
      const events = await this.repository.getShareEvents(userId);
      console.log(`Retrieved ${events.length} share events for user ${userId}`);
      return events;
    } catch (error) {
      console.error('Failed to get share events:', error);
      throw error;
    }
  }

  /**
   * Récupère les consentements actifs d'un utilisateur
   * 
   * @param userId Identifiant de l'utilisateur
   * @returns Un objet avec les types de consentement comme clés et les valeurs de consentement comme valeurs
   */
  async getUserActiveConsents(userId: string): Promise<Record<string, boolean>> {
    // console.log('🔍 [UserService.getUserActiveConsents] Getting consents for user:', userId);
    try {
      const consents = await this.repository.getUserActiveConsents(userId);
      // console.log('✅ [UserService.getUserActiveConsents] Got consents:', consents);
      return consents;
    } catch (error) {
      console.error('❌ [UserService.getUserActiveConsents] Error:', error);
      throw error;
    }
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
    return this.repository.getConsentHistory(userId, consentType);
  }

  /**
   * Vérifie si un utilisateur a donné son consentement pour un type spécifique
   * 
   * @param userId Identifiant de l'utilisateur
   * @param consentType Type de consentement à vérifier
   * @returns true si l'utilisateur a un consentement actif et positif, false sinon
   */
  async hasActiveConsent(userId: string, consentType: string): Promise<boolean> {
    const consents = await this.getUserActiveConsents(userId);
    return !!consents[consentType];
  }


  async updateNewsletterConsent(
    userId: string,
    email: string | null,
    value: boolean,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    // Valider l'email si fourni
    if (email && !isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Vérifier si l'email existe déjà pour un autre utilisateur
    if (email) {
      const existingUser = await this.repository.getUser(userId);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email already exists');
      }
    }

    await this.repository.updateNewsletterConsent(userId, email, value, metadata);
  }

  async updateUserOnboarded(userId: string, onboarded: boolean): Promise<void> {
    // TODO: implementer la mise à jour de l'utilisateur onboarded
  }

  async getLanguagePreference(userId: string) {
    try {
      const langPref = await this.repository.getUserLanguagePreference(userId);
      return langPref || { language: 'en' }; // Default to English if no preference is set
    } catch (error) {
      console.error('❌ [UserService.getLanguagePreference] Error:', error);
      throw error;
    }
  }

  async updateLanguagePreference(
    userId: string,
    language: string,
  ): Promise<void> {
    if (!userId) {
      throw new Error('User ID is required to update language preference');
    }
    
    if (!language) {
      throw new Error('Language is required');
    }
    
    // Validate language code (you might want to add more validation)
    const validLanguages = ['en', 'fr', 'es', 'de', 'it', 'sv', 'pt' ];
    if (!validLanguages.includes(language.toLowerCase())) {
      throw new Error(`Invalid language code: ${language}`);
    }
    
    await this.repository.updateLanguagePreference(userId, language.toLowerCase());
  }

  /**
   * Désactive complètement le support personnalisé pour un utilisateur
   * - Supprime tous les enregistrements personalized_support_listing
   * - Supprime les tâches Python en attente (send-reco-newsletter)
   * - Force la désactivation des consents bluesky_dm et mastodon_dm
   * 
   * @param userId Identifiant de l'utilisateur
   * @param metadata Métadonnées pour les logs
   */
  async disablePersonalizedSupport(userId: string, metadata: Record<string, any> = {}): Promise<void> {
    try {
      // 1. Supprimer tous les enregistrements personalized_support_listing
      await this.repository.deletePersonalizedSupportListing(userId);

      // 2. Supprimer les tâches Python en attente (send-reco-newsletter)
      await this.repository.deletePendingPythonTasks(userId, undefined, 'send-reco-newsletter');

      // 3. Force désactivation des consents bluesky_dm et mastodon_dm
      await this.forceDisablePlatformConsents(userId, metadata);

    } catch (error) {
      console.error('❌ [UserService.disablePersonalizedSupport] Error:', error);
      throw error;
    }
  }

  /**
   * Force la désactivation des consents bluesky_dm et mastodon_dm
   * 
   * @param userId Identifiant de l'utilisateur
   * @param metadata Métadonnées pour les logs
   */
  private async forceDisablePlatformConsents(userId: string, metadata: Record<string, any> = {}): Promise<void> {
    const platforms = ['bluesky_dm', 'mastodon_dm'];
    
    for (const consentType of platforms) {
      try {
        // Vérifier si un consent actif existe
        const consents = await this.repository.getUserActiveConsents(userId);
        
        if (consents[consentType]) {
          // Insérer un nouveau consent désactivé
          await this.repository.insertNewsletterConsent(userId, consentType, false, metadata);
        }
      } catch (error) {
        console.error(`❌ [UserService.forceDisablePlatformConsents] Error for ${consentType}:`, error);
        // Continue avec les autres plateformes même en cas d'erreur
      }
    }
  }

  /**
   * Active le support personnalisé pour une plateforme spécifique
   * - Insère le consent dans newsletter_consents
   * - Crée une tâche test-dm via Redis (avec déduplication)
   * 
   * @param userId Identifiant de l'utilisateur
   * @param platform Plateforme (bluesky ou mastodon)
   * @param userHandles Handles de l'utilisateur (depuis la session)
   * @param metadata Métadonnées pour les logs
   */
  async enablePersonalizedSupportForPlatform(
    userId: string, 
    platform: 'bluesky' | 'mastodon',
    userHandles: { bluesky_username?: string; mastodon_username?: string; mastodon_instance?: string },
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const consentType = `${platform}_dm`;
      
      // 1. Insérer le consent dans newsletter_consents (source unique de vérité)
      await this.repository.insertNewsletterConsent(userId, consentType, true, metadata);

      // 2. Créer tâche test-dm via Redis (avec déduplication)
      await this.createTestDMTaskInRedis(userId, platform, userHandles);

    } catch (error) {
      console.error(`❌ [UserService.enablePersonalizedSupportForPlatform] Error for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Désactive le support personnalisé pour une plateforme spécifique
   * - Supprime de personalized_support_listing
   * - Supprime les tâches Python en attente pour cette plateforme
   * 
   * @param userId Identifiant de l'utilisateur
   * @param platform Plateforme (bluesky ou mastodon)
   */
  async disablePersonalizedSupportForPlatform(
    userId: string, 
    platform: 'bluesky' | 'mastodon',
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const consentType = `${platform}_dm`;
      
      // 1. Insérer un consent désactivé dans newsletter_consents (source unique de vérité)
      await this.repository.insertNewsletterConsent(userId, consentType, false, metadata);

      // 2. Supprimer les tâches Python en attente pour cette plateforme
      await this.repository.deletePendingPythonTasks(userId, platform, 'send-reco-newsletter');

    } catch (error) {
      console.error(`❌ [UserService.disablePersonalizedSupportForPlatform] Error for ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Crée une tâche test-dm dans Redis avec déduplication
   * 
   * @param userId Identifiant de l'utilisateur
   * @param platform Plateforme (bluesky ou mastodon)
   * @param userHandles Handles de l'utilisateur
   */
  private async createTestDMTaskInRedis(
    userId: string, 
    platform: 'bluesky' | 'mastodon',
    userHandles: { bluesky_username?: string; mastodon_username?: string; mastodon_instance?: string }
  ): Promise<void> {
    try {
      // Construire le handle selon la plateforme
      let handle: string | null = null;
      if (platform === 'bluesky' && userHandles.bluesky_username) {
        handle = userHandles.bluesky_username;
      } else if (platform === 'mastodon' && userHandles.mastodon_username && userHandles.mastodon_instance) {
        handle = `${userHandles.mastodon_username}@${userHandles.mastodon_instance}`;
      }

      if (!handle) {
        console.log(`[UserService.createTestDMTaskInRedis] No valid handle for ${platform}, skipping task creation`);
        return;
      }

      // Créer la tâche avec métadonnées
      const taskData = {
        user_id: userId,
        task_type: 'test-dm',
        platform: platform,
        handle: handle,
        created_at: new Date().toISOString(),
        status: 'pending'
      };

      // Clé Redis pour la queue du jour
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const queueKey = `consent_tasks:${today}`;
      
      // Clé de déduplication
      const dedupeKey = `task_dedup:${userId}:${platform}:test-dm`;

      console.log(`[UserService.createTestDMTaskInRedis] Creating task for ${platform} with handle ${handle}`);
      
      // const redis = getRedisClient();
      
      // Vérifier si une tâche similaire existe déjà (déduplication)
      const existingTask = await redis.get(dedupeKey);
      if (existingTask) {
        console.log(`[UserService.createTestDMTaskInRedis] Task already exists for ${userId}:${platform}, skipping`);
        return;
      }
      
      // Ajouter la tâche à la queue Redis
      await redis.lpush(queueKey, JSON.stringify(taskData));
      
      // Marquer comme traité pour déduplication (expire après 1 heure)
      await redis.setex(dedupeKey, 3600, JSON.stringify(taskData));
      
      console.log(`[UserService.createTestDMTaskInRedis] Task queued in ${queueKey} with deduplication key ${dedupeKey}`);

    } catch (error) {
      console.error(`❌ [UserService.createTestDMTaskInRedis] Error for ${platform}:`, error);
      // Ne pas throw - les tâches Redis sont non-critiques
    }
  }
}