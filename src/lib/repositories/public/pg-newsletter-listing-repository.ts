import { queryPublic } from '../../database'
import { pgUserRepository } from '../auth/pg-user-repository'
import logger from '../../log_utils'

export interface NewsletterListing {
  id?: string
  user_id: string
  email: string
  created_at?: string
  updated_at?: string
}

/**
 * Repository pour les opérations sur la liste de newsletter (schéma public)
 * Gère la table newsletter_listing
 */
export const pgNewsletterListingRepository = {
  /**
   * Insère un utilisateur dans la liste de newsletter
   * Récupère l'email depuis la table users
   */
  async insertNewsletterListing(userId: string): Promise<void> {
    try {
      // Récupère l'utilisateur pour obtenir son email
      const user = await pgUserRepository.getUser(userId)
      if (!user || !user.email) {
        throw new Error('User not found or email missing')
      }

      // Insère dans newsletter_listing
      await queryPublic(
        `INSERT INTO newsletter_listing (user_id, email, created_at, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [userId, user.email]
      )
    } catch (error: any) {
      // Ignorer les erreurs de conflit (utilisateur déjà présent)
      if (error.code !== '23505') {
        // unique_violation
        logger.logError('Repository', 'pgNewsletterListingRepository.insertNewsletterListing', 'Error inserting newsletter listing', userId, { error })
        throw error
      }
      // Silencieusement ignorer les doublons
    }
  },

  /**
   * Supprime un utilisateur de la liste de newsletter
   */
  async deleteNewsletterListing(userId: string): Promise<void> {
    try {
      await queryPublic(`DELETE FROM newsletter_listing WHERE user_id = $1`, [userId])
    } catch (error) {
      logger.logError('Repository', 'pgNewsletterListingRepository.deleteNewsletterListing', 'Error deleting newsletter listing', userId, { error })
      throw error
    }
  },

  /**
   * Récupère une entrée de newsletter listing
   */
  async getNewsletterListing(userId: string): Promise<NewsletterListing | null> {
    try {
      const result = await queryPublic<NewsletterListing>(
        `SELECT * FROM newsletter_listing WHERE user_id = $1`,
        [userId]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgNewsletterListingRepository.getNewsletterListing', 'Error fetching newsletter listing', userId, { error })
      throw error
    }
  },

  /**
   * Vérifie si un utilisateur est dans la liste de newsletter
   */
  async isInNewsletterListing(userId: string): Promise<boolean> {
    try {
      const listing = await this.getNewsletterListing(userId)
      return listing !== null
    } catch (error) {
      logger.logError('Repository', 'pgNewsletterListingRepository.isInNewsletterListing', 'Error checking newsletter listing', userId, { error })
      return false
    }
  },
}
