import { UserUpdate, ShareEvent } from '../types/user'
import { pgUserRepository } from './auth/pg-user-repository'
import { pgConsentRepository } from './public/pg-consent-repository'
import { pgShareEventsRepository } from './public/pg-share-events-repository'
import { pgLanguagePrefRepository } from './public/pg-language-pref-repository'
import { pgNewsletterListingRepository } from './public/pg-newsletter-listing-repository'
import { logError } from '../log_utils'

/**
 * DEPRECATED: UserRepository is being refactored to use separate repositories
 * This class now delegates to:
 * - pgUserRepository (next-auth.users)
 * - pgConsentRepository (newsletter_consents)
 * - pgShareEventsRepository (share_events)
 * - pgLanguagePrefRepository (language_pref)
 * - pgNewsletterListingRepository (newsletter_listing)
 *
 * This class is kept for backward compatibility during migration.
 * New code should use the specific repositories directly.
 */
export class UserRepository {
  /**
   * Updates a user
   * @deprecated Use pgUserRepository.updateUser() instead
   */
  async updateUser(userId: string, update: UserUpdate): Promise<void> {
    await pgUserRepository.updateUser(userId, update)
  }

  /**
   * Gets a user by ID
   * @deprecated Use pgUserRepository.getUser() instead
   */
  async getUser(userId: string) {
    return await pgUserRepository.getUser(userId)
  }

  /**
   * Creates a share event
   * @deprecated Use pgShareEventsRepository.createShareEvent() instead
   */
  async createShareEvent(event: ShareEvent): Promise<void> {
    return pgShareEventsRepository.createShareEvent(event)
  }

  /**
   * Gets share events for a user
   * @deprecated Use pgShareEventsRepository.getShareEvents() instead
   */
  async getShareEvents(userId: string): Promise<ShareEvent[]> {
    return pgShareEventsRepository.getShareEvents(userId)
  }

  /**
   * Checks if a user has share events
   * @deprecated Use pgShareEventsRepository.hasShareEvents() instead
   */
  async hasShareEvents(userId: string): Promise<boolean> {
    return pgShareEventsRepository.hasShareEvents(userId)
  }

  /**
   * Gets active consents for a user
   * @deprecated Use pgConsentRepository.getUserActiveConsents() instead
   */
  async getUserActiveConsents(userId: string): Promise<Record<string, boolean>> {
    return pgConsentRepository.getUserActiveConsents(userId)
  }

  /**
   * Gets consent history for a user
   * @deprecated Use pgConsentRepository.getConsentHistory() instead
   */
  async getConsentHistory(
    userId: string,
    consentType?: string
  ): Promise<
    Array<{
      consent_type: string
      consent_value: boolean
      consent_timestamp: string
      is_active: boolean
    }>
  > {
    return pgConsentRepository.getConsentHistory(userId, consentType)
  }

  /**
   * Updates a consent for a user
   * @deprecated Use pgConsentRepository.updateConsent() instead
   */
  async updateConsent(
    userId: string,
    type: string,
    value: boolean,
    metadata?: {
      ip_address?: string
      user_agent?: string
    }
  ): Promise<void> {
    return pgConsentRepository.updateConsent(userId, type, value, metadata)
  }

  /**
   * Inserts a newsletter consent
   * @deprecated Use pgConsentRepository.insertConsent() instead
   */
  async insertNewsletterConsent(
    userId: string,
    consentType: string,
    consentValue: boolean,
    metadata: Record<string, any> = {}
  ): Promise<any> {
    return pgConsentRepository.insertConsent({
      user_id: userId,
      consent_type: consentType,
      consent_value: consentValue,
      ip_address: metadata?.ip || null,
      user_agent: metadata?.userAgent || null,
      is_active: true,
    })
  }

  /**
   * Updates newsletter consent
   * @deprecated Use pgConsentRepository.upsertConsent() and pgUserRepository.updateUser() instead
   */
  async updateNewsletterConsent(
    userId: string,
    email: string | null,
    value: boolean,
    metadata: any
  ): Promise<void> {
    // Update consent
    await pgConsentRepository.upsertConsent({
      user_id: userId,
      consent_type: 'email_newsletter',
      consent_value: value,
      ip_address: metadata?.ip_address,
      user_agent: metadata?.user_agent,
      is_active: true,
    })

    // Update email if provided
    if (email) {
      await pgUserRepository.updateUser(userId, { email })
    }
  }

  /**
   * Gets language preference for a user
   * @deprecated Use pgLanguagePrefRepository.getUserLanguagePreference() instead
   */
  async getUserLanguagePreference(userId: string) {
    return pgLanguagePrefRepository.getUserLanguagePreference(userId)
  }

  /**
   * Updates language preference for a user
   * @deprecated Use pgLanguagePrefRepository.updateLanguagePreference() instead
   */
  async updateLanguagePreference(userId: string, language: string): Promise<void> {
    return pgLanguagePrefRepository.updateLanguagePreference(userId, language)
  }

  /**
   * Deletes pending Python tasks
   * Note: This method includes Redis cleanup logic that cannot be easily separated
   */
  async deletePendingPythonTasks(
    userId: string,
    platform?: 'bluesky' | 'mastodon',
    taskType?: string
  ): Promise<void> {
    try {
      const { queryPublic } = await import('../database')

      let query = `DELETE FROM python_tasks WHERE user_id = $1 AND status IN ('pending', 'waiting')`
      const params: any[] = [userId]

      if (platform) {
        query += ` AND platform = $${params.length + 1}`
        params.push(platform)
      }

      if (taskType) {
        query += ` AND task_type = $${params.length + 1}`
        params.push(taskType)
      }

      await queryPublic(query, params)

      // Cleanup Redis
      await this.cleanupRedisForDeletedTasks(userId, platform, taskType)
    } catch (error) {
      logError('Repository', 'UserRepository.deletePendingPythonTasks', error as Error, userId, { platform, taskType })
      throw error
    }
  }

  /**
   * Cleans up Redis for deleted tasks
   * Private method - keeps Redis cleanup logic separate
   */
  private async cleanupRedisForDeletedTasks(
    userId: string,
    platform?: 'bluesky' | 'mastodon',
    taskType?: string
  ): Promise<void> {
    try {
      const { redis } = await import('@/lib/redis')

      // 1. Delete dedup keys
      if (platform && taskType) {
        const dedupKey = `task_dedup:${userId}:${platform}:${taskType}`
        await redis.del(dedupKey)
      } else if (platform) {
        const pattern = `task_dedup:${userId}:${platform}:*`
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.redisClient.del(...keys)
        }
      } else {
        const pattern = `task_dedup:${userId}:*`
        const keys = await redis.keys(pattern)
        if (keys.length > 0) {
          await redis.redisClient.del(...keys)
        }
      }

      // 2. Delete tasks from Redis queue
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
      const queueKey = `consent_tasks:${today}`

      const queueTasks = await redis.lrange(queueKey, 0, -1)
      let removedCount = 0

      for (const taskJson of queueTasks) {
        try {
          const task = JSON.parse(taskJson)

          let shouldRemove = false

          if (task.user_id === userId) {
            if (platform && taskType) {
              shouldRemove = task.platform === platform && task.task_type === taskType
            } else if (platform) {
              shouldRemove = task.platform === platform
            } else {
              shouldRemove = true
            }
          }

          if (shouldRemove) {
            await redis.lrem(queueKey, 0, taskJson)
            removedCount++
          }
        } catch (parseError) {
          console.warn(`⚠️ [cleanupRedisForDeletedTasks] Failed to parse task JSON: ${taskJson}`)
        }
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logError('Repository', 'UserRepository.cleanupRedisForDeletedTasks', errorString, userId, { platform, taskType })
      // Don't fail if Redis cleanup fails
    }
  }

  /**
   * Inserts a user into newsletter listing
   * @deprecated Use pgNewsletterListingRepository.insertNewsletterListing() instead
   */
  async insertNewsletterListing(userId: string): Promise<void> {
    return pgNewsletterListingRepository.insertNewsletterListing(userId)
  }

  /**
   * Deletes a user from newsletter listing
   * @deprecated Use pgNewsletterListingRepository.deleteNewsletterListing() instead
   */
  async deleteNewsletterListing(userId: string): Promise<void> {
    return pgNewsletterListingRepository.deleteNewsletterListing(userId)
  }
}