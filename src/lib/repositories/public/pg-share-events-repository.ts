import { queryPublic } from '../../database'
import { ShareEvent } from '../../types/user'
import logger from '../../log_utils'

/**
 * Repository pour les opérations sur les événements de partage (schéma public)
 * Gère la table share_events
 */
export const pgShareEventsRepository = {
  /**
   * Crée un nouvel événement de partage
   */
  async createShareEvent(event: ShareEvent): Promise<void> {
    try {
      await queryPublic(
        `INSERT INTO share_events (source_id, platform, shared_at, success, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [event.source_id, event.platform, event.shared_at, event.success]
      )
    } catch (error) {
      logger.logError('Repository', 'pgShareEventsRepository.createShareEvent', 'Error creating share event', event.source_id, { event, error })
      throw error
    }
  },

  /**
   * Récupère tous les événements de partage d'un utilisateur source
   * Ordonnés par date de création (DESC)
   */
  async getShareEvents(userId: string): Promise<ShareEvent[]> {
    try {
      const result = await queryPublic<ShareEvent>(
        `SELECT * FROM share_events 
         WHERE source_id = $1 
         ORDER BY created_at DESC`,
        [userId]
      )
      return result.rows
    } catch (error) {
      logger.logError('Repository', 'pgShareEventsRepository.getShareEvents', 'Error fetching share events', userId, { error })
      throw error
    }
  },

  /**
   * Vérifie si un utilisateur a des événements de partage
   */
  async hasShareEvents(userId: string): Promise<boolean> {
    try {
      const result = await queryPublic<{ count: number }>(
        `SELECT COUNT(*) as count FROM share_events WHERE source_id = $1`,
        [userId]
      )
      return result.rows[0]?.count > 0 || false
    } catch (error) {
      logger.logError('Repository', 'pgShareEventsRepository.hasShareEvents', 'Error checking share events', userId, { error })
      throw error
    }
  },

  /**
   * Supprime tous les événements de partage d'un utilisateur
   */
  async deleteShareEvents(userId: string): Promise<void> {
    try {
      await queryPublic(`DELETE FROM share_events WHERE source_id = $1`, [userId])
    } catch (error) {
      logger.logError('Repository', 'pgShareEventsRepository.deleteShareEvents', 'Error deleting share events', userId, { error })
      throw error
    }
  },
}
