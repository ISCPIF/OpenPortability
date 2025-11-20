import { queryNextAuth } from '../../database'
import type { DBUser } from '../../types/database'
import logger from '../../log_utils'

/**
 * Repository pour les opérations sur les utilisateurs (schéma next-auth)
 */
export const pgUserRepository = {
  /**
   * Récupère un utilisateur par son ID
   */
  async getUser(userId: string): Promise<DBUser | null> {
    try {
      const result = await queryNextAuth<DBUser>(
        'SELECT * FROM "next-auth".users WHERE id = $1',
        [userId]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.getUser', 'Error fetching user', userId, { error })
      throw error
    }
  },

  /**
   * Récupère un utilisateur par email
   */
  async getUserByEmail(email: string): Promise<DBUser | null> {
    try {
      const result = await queryNextAuth<DBUser>(
        'SELECT * FROM "next-auth".users WHERE email = $1',
        [email]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.getUserByEmail', 'Error fetching user by email', undefined, { email, error })
      throw error
    }
  },

  /**
   * Récupère un utilisateur par provider ID
   */
  async getUserByProviderId(
    provider: 'twitter' | 'bluesky' | 'mastodon' | 'facebook',
    providerId: string
  ): Promise<DBUser | null> {
    try {
      const columnMap = {
        twitter: 'twitter_id',
        bluesky: 'bluesky_id',
        mastodon: 'mastodon_id',
        facebook: 'facebook_id',
      }

      const column = columnMap[provider]
      const result = await queryNextAuth<DBUser>(
        `SELECT * FROM "next-auth".users WHERE ${column} = $1`,
        [providerId]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.getUserByProviderId', 'Error fetching user by provider', undefined, {
        provider,
        providerId,
        error
      })
      throw error
    }
  },

  /**
   * Crée un nouvel utilisateur
   */
  async createUser(userData: Partial<DBUser>): Promise<DBUser> {
    try {
      const fields = Object.keys(userData).filter(key => key !== 'id')
      const values = fields.map(field => userData[field as keyof DBUser])
      const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ')
      
      const sql = `
        INSERT INTO "next-auth".users (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `
      
      const result = await queryNextAuth<DBUser>(sql, values)
      
      if (!result.rows[0]) {
        throw new Error('Failed to create user')
      }
      
      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.createUser', 'Error creating user', undefined, { userData, error })
      throw error
    }
  },

  /**
   * Met à jour un utilisateur
   */
  async updateUser(userId: string, updates: Partial<DBUser>): Promise<DBUser> {
    try {
      const fields = Object.keys(updates).filter(key => key !== 'id')
      const setClauses = fields.map((field, i) => `${field} = $${i + 2}`).join(', ')
      const values = [userId, ...fields.map(field => updates[field as keyof DBUser])]
      
      const sql = `
        UPDATE "next-auth".users
        SET ${setClauses}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `
      
      const result = await queryNextAuth<DBUser>(sql, values)
      
      if (!result.rows[0]) {
        throw new Error('User not found')
      }
      
      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.updateUser', 'Error updating user', userId, { updates, error })
      throw error
    }
  },

  /**
   * Supprime un utilisateur
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await queryNextAuth('DELETE FROM "next-auth".users WHERE id = $1', [userId])
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.deleteUser', 'Error deleting user', userId, { error })
      throw error
    }
  },

  /**
   * Vérifie si un utilisateur a des share events
   */
  async hasShareEvents(userId: string): Promise<boolean> {
    try {
      const result = await queryNextAuth<{ count: string }>(
        'SELECT COUNT(*) as count FROM share_events WHERE source_id = $1',
        [userId]
      )
      return result.rows[0] ? parseInt(result.rows[0].count, 10) > 0 : false
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.hasShareEvents', 'Error checking share events', userId, { error })
      throw error
    }
  },

  /**
   * Récupère les consentements actifs d'un utilisateur
   */
  async getUserActiveConsents(userId: string): Promise<Record<string, boolean>> {
    try {
      const result = await queryNextAuth<{ consent_type: string; consent_value: boolean }>(
        'SELECT consent_type, consent_value FROM newsletter_consents WHERE user_id = $1 AND is_active = true',
        [userId]
      )

      const consents: Record<string, boolean> = {}
      result.rows.forEach((row) => {
        consents[row.consent_type] = row.consent_value
      })

      return consents
    } catch (error) {
      logger.logError('Repository', 'pgUserRepository.getUserActiveConsents', 'Error fetching user consents', userId, { error })
      throw error
    }
  },
}
