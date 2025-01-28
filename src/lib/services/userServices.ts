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
      update.oep_accepted = true;
    }

    if (!data.email && data.acceptHQX) {
      update.hqx_newsletter = true;
    }

    if (data.research_accepted) {
      update.research_accepted = true;
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
}