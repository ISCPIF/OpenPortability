import { UserRepository } from '@/lib/repositories/userRepository';
import { redis } from '@/lib/redis';
import { NewsletterUpdate, ShareEvent, User } from '../types/user';
import { isValidEmail } from '../utils';
import logger from '../log_utils';

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
   * Met à jour le statut have_seen_v2 d'un utilisateur
   */
  async updateHaveSeenV2(userId: string): Promise<void> {
    await this.repository.updateHaveSeenV2(userId);
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
    try {
      // Récupérer l'email de l'utilisateur et have_seen_newsletter
      const user = await this.repository.getUser(userId);
      if (!user) {
        
        throw new Error('User not found');
      }

      // Récupérer les consentements actifs
      const activeConsents = await this.repository.getUserActiveConsents(userId);
      
      return {
        email: user.email ?? undefined,
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
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to record share event:', errorString, "system");
      throw error;
    }
  }

  async getUserShareEvents(userId: string): Promise<ShareEvent[]> {
    try {
      const events = await this.repository.getShareEvents(userId);
      return events;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to get share events:', errorString, "system");
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
    try {
      const consents = await this.repository.getUserActiveConsents(userId);
      return consents;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to get user active consents:', errorString, "system");
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to get language preference:', errorString, "system");
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
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to enable personalized support for platform:', errorString, "system");
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

      
      // const redis = getRedisClient();
      
      // Vérifier si une tâche similaire existe déjà (déduplication)
      const existingTask = await redis.get(dedupeKey);
      if (existingTask) {
        return;
      }
      
      // Ajouter la tâche à la queue Redis
      await redis.lpush(queueKey, JSON.stringify(taskData));
      
      // Marquer comme traité pour déduplication (expire après 1 heure)
      await redis.setex(dedupeKey, 3600, JSON.stringify(taskData));
      

    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError('Failed to create test DM task in Redis:', errorString, "system");
      // Ne pas throw - les tâches Redis sont non-critiques
    }
  }
}