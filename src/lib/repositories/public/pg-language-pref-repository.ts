import { queryPublic } from '../../database'
import logger from '../../log_utils'

export interface LanguagePreference {
  id?: string
  user_id: string
  language: string
  created_at?: string
  updated_at?: string
}

/**
 * Repository pour les opérations sur les préférences de langue (schéma public)
 * Gère la table language_pref
 */
export const pgLanguagePrefRepository = {
  /**
   * Récupère la préférence de langue d'un utilisateur
   */
  async getUserLanguagePreference(userId: string): Promise<LanguagePreference | null> {
    try {
      const result = await queryPublic<LanguagePreference>(
        `SELECT * FROM language_pref WHERE user_id = $1`,
        [userId]
      )
      return result.rows[0] || null
    } catch (error) {
      // Log but don't throw - this is a non-critical preference
      logger.logWarning('Repository', 'pgLanguagePrefRepository.getUserLanguagePreference', 'Error fetching language preference', userId)
      return null
    }
  },

  /**
   * Met à jour la préférence de langue d'un utilisateur
   * Crée une nouvelle entrée si elle n'existe pas
   */
  async updateLanguagePreference(userId: string, language: string): Promise<void> {
    try {
      await queryPublic(
        `INSERT INTO language_pref (user_id, language, created_at, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id)
         DO UPDATE SET language = $2, updated_at = CURRENT_TIMESTAMP`,
        [userId, language]
      )
    } catch (error) {
      logger.logError('Repository', 'pgLanguagePrefRepository.updateLanguagePreference', 'Error updating language preference', userId, { language, error })
      throw error
    }
  },

  /**
   * Supprime la préférence de langue d'un utilisateur
   */
  async deleteLanguagePreference(userId: string): Promise<void> {
    try {
      await queryPublic(`DELETE FROM language_pref WHERE user_id = $1`, [userId])
    } catch (error) {
      logger.logError('Repository', 'pgLanguagePrefRepository.deleteLanguagePreference', 'Error deleting language preference', userId, { error })
      throw error
    }
  },
}
