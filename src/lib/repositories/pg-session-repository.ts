import { queryNextAuth } from '../database'
import type { DBSession, DBUser } from '../types/database'
import logger from '../log_utils'

/**
 * Repository pour les opérations sur les sessions (schéma next-auth)
 */
export const pgSessionRepository = {
  /**
   * Récupère une session par son token
   */
  async getSession(sessionToken: string): Promise<DBSession | null> {
    try {
      const result = await queryNextAuth<DBSession>(
        'SELECT * FROM sessions WHERE "sessionToken" = $1',
        [sessionToken]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.getSession', 'Error fetching session', undefined, {
        sessionToken,
        error
      })
      throw error
    }
  },

  /**
   * Récupère une session avec l'utilisateur associé
   */
  async getSessionAndUser(sessionToken: string): Promise<{ session: DBSession; user: DBUser } | null> {
    try {
      const result = await queryNextAuth<any>(
        `SELECT 
          s.id as session_id,
          s."sessionToken",
          s."userId",
          s.expires,
          s.created_at as session_created_at,
          s.updated_at as session_updated_at,
          u.id as user_id,
          u.name,
          u.email,
          u."emailVerified",
          u.image,
          u.has_onboarded,
          u.hqx_newsletter,
          u.oep_accepted,
          u.have_seen_newsletter,
          u.research_accepted,
          u.automatic_reconnect,
          u.twitter_id,
          u.twitter_username,
          u.twitter_image,
          u.bluesky_id,
          u.bluesky_username,
          u.bluesky_image,
          u.mastodon_id,
          u.mastodon_username,
          u.mastodon_image,
          u.mastodon_instance,
          u.facebook_id,
          u.facebook_image,
          u.created_at as user_created_at,
          u.updated_at as user_updated_at
        FROM sessions s
        INNER JOIN users u ON s."userId" = u.id
        WHERE s."sessionToken" = $1`,
        [sessionToken]
      )

      if (!result.rows[0]) {
        return null
      }

      const row = result.rows[0]
      
      return {
        session: {
          id: row.session_id,
          sessionToken: row.sessionToken,
          userId: row.userId,
          expires: row.expires,
          created_at: row.session_created_at,
          updated_at: row.session_updated_at,
        },
        user: {
          id: row.user_id,
          name: row.name,
          email: row.email,
          emailVerified: row.emailVerified,
          image: row.image,
          has_onboarded: row.has_onboarded,
          hqx_newsletter: row.hqx_newsletter,
          oep_accepted: row.oep_accepted,
          have_seen_newsletter: row.have_seen_newsletter,
          research_accepted: row.research_accepted,
          automatic_reconnect: row.automatic_reconnect,
          twitter_id: row.twitter_id,
          twitter_username: row.twitter_username,
          twitter_image: row.twitter_image,
          bluesky_id: row.bluesky_id,
          bluesky_username: row.bluesky_username,
          bluesky_image: row.bluesky_image,
          mastodon_id: row.mastodon_id,
          mastodon_username: row.mastodon_username,
          mastodon_image: row.mastodon_image,
          mastodon_instance: row.mastodon_instance,
          facebook_id: row.facebook_id,
          facebook_image: row.facebook_image,
          created_at: row.user_created_at,
          updated_at: row.user_updated_at,
        },
      }
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.getSessionAndUser', 'Error fetching session and user', undefined, {
        sessionToken,
        error
      })
      throw error
    }
  },

  /**
   * Crée une nouvelle session
   */
  async createSession(sessionData: {
    sessionToken: string
    userId: string
    expires: Date
  }): Promise<DBSession> {
    try {
      const result = await queryNextAuth<DBSession>(
        `INSERT INTO sessions ("sessionToken", "userId", expires)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [sessionData.sessionToken, sessionData.userId, sessionData.expires]
      )

      if (!result.rows[0]) {
        throw new Error('Failed to create session')
      }

      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.createSession', 'Error creating session', sessionData.userId, {
        sessionData,
        error
      })
      throw error
    }
  },

  /**
   * Met à jour une session
   */
  async updateSession(sessionToken: string, updates: Partial<DBSession>): Promise<DBSession> {
    try {
      const fields = Object.keys(updates).filter(key => key !== 'sessionToken')
      const setClauses = fields.map((field, i) => `"${field}" = $${i + 2}`).join(', ')
      const values = [sessionToken, ...fields.map(field => updates[field as keyof DBSession])]

      const sql = `
        UPDATE sessions
        SET ${setClauses}, updated_at = NOW()
        WHERE "sessionToken" = $1
        RETURNING *
      `

      const result = await queryNextAuth<DBSession>(sql, values)

      if (!result.rows[0]) {
        throw new Error('Session not found')
      }

      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.updateSession', 'Error updating session', undefined, {
        sessionToken,
        updates,
        error
      })
      throw error
    }
  },

  /**
   * Supprime une session
   */
  async deleteSession(sessionToken: string): Promise<void> {
    try {
      await queryNextAuth('DELETE FROM sessions WHERE "sessionToken" = $1', [sessionToken])
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.deleteSession', 'Error deleting session', undefined, {
        sessionToken,
        error
      })
      throw error
    }
  },

  /**
   * Supprime toutes les sessions d'un utilisateur
   */
  async deleteSessionsByUserId(userId: string): Promise<void> {
    try {
      await queryNextAuth('DELETE FROM sessions WHERE "userId" = $1', [userId])
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.deleteSessionsByUserId', 'Error deleting sessions', userId, { error })
      throw error
    }
  },

  /**
   * Supprime les sessions expirées
   */
  async deleteExpiredSessions(): Promise<number> {
    try {
      const result = await queryNextAuth('DELETE FROM sessions WHERE expires < NOW()')
      return result.rowCount || 0
    } catch (error) {
      logger.logError('Repository', 'pgSessionRepository.deleteExpiredSessions', 'Error deleting expired sessions', undefined, { error })
      throw error
    }
  },
}
