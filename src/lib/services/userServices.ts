import { UserRepository } from '../repositories/userRepository';
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

    await this.repository.updateUser(userId, update);
  }

  async getNewsletterPreferences(userId: string): Promise<{
    email?: string;
    hqx_newsletter: boolean;
    oep_accepted: boolean;
    research_accepted: boolean;
    have_seen_newsletter: boolean;
  }> {
    try {
      const user = await this.repository.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      return {
        email: user.email,
        hqx_newsletter: user.hqx_newsletter,
        oep_accepted: user.oep_accepted,
        research_accepted: user.research_accepted,
        have_seen_newsletter: user.have_seen_newsletter
      };
    } catch (error) {
      console.error('Failed to get newsletter preferences:', error);
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
    return this.repository.getUserActiveConsents(userId);
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

  /**
   * Enregistre un consentement utilisateur
   * 
   * @param userId Identifiant de l'utilisateur
   * @param consentType Type de consentement (email_newsletter, bluesky_dm, etc.)
   * @param consentValue Valeur du consentement (true/false)
   * @param metadata Métadonnées additionnelles à stocker (user-agent, etc.)
   * @returns Le consentement créé
   */
  async recordConsent(
    userId: string,
    consentType: string,
    consentValue: boolean,
    metadata: Record<string, any> = {}
  ): Promise<any> {
    if (!userId) {
      throw new Error('User ID is required to record consent');
    }
    
    if (!consentType) {
      throw new Error('Consent type is required');
    }
    
    // Vérifier que consentType est une valeur valide
    const validConsentTypes = [
      'email_newsletter',
      'bluesky_dm',
      'research_participation',
      'oep_newsletter'
    ];
    
    if (!validConsentTypes.includes(consentType)) {
      throw new Error(`Invalid consent type: ${consentType}`);
    }
    
    return this.repository.insertNewsletterConsent(userId, consentType, consentValue, metadata);
  }

  async updateUserOnboarded(userId: string, onboarded: boolean): Promise<void> {
    // TODO: implementer la mise à jour de l'utilisateur onboarded
  }
}