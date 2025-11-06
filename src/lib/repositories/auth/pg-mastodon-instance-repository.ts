import { queryPublic } from '../../database'
import type { DBMastodonInstance } from '../../types/database'
import logger from '../../log_utils'

/**
 * Repository pour les opérations sur les instances Mastodon (schéma public)
 */
export const pgMastodonInstanceRepository = {
  /**
   * Récupère une instance Mastodon par son nom
   */
  async getInstance(instance: string): Promise<DBMastodonInstance | null> {
    try {
      const result = await queryPublic<DBMastodonInstance>(
        'SELECT * FROM mastodon_instances WHERE instance = $1',
        [instance.toLowerCase()]
      )
      return result.rows[0] || null
    } catch (error) {
      logger.logError('Repository', 'pgMastodonInstanceRepository.getInstance', 'Error fetching instance', undefined, {
        instance,
        error
      })
      throw error
    }
  },

  /**
   * Récupère toutes les instances Mastodon
   */
  async getAllInstances(): Promise<DBMastodonInstance[]> {
    try {
      const result = await queryPublic<DBMastodonInstance>(
        'SELECT * FROM mastodon_instances ORDER BY instance ASC'
      )
      return result.rows
    } catch (error) {
      logger.logError('Repository', 'pgMastodonInstanceRepository.getAllInstances', 'Error fetching all instances', undefined, { error })
      throw error
    }
  },

  /**
   * Crée une nouvelle instance Mastodon
   */
  async createInstance(instanceData: {
    instance: string
    client_id: string
    client_secret: string
  }): Promise<DBMastodonInstance> {
    try {
      const result = await queryPublic<DBMastodonInstance>(
        `INSERT INTO mastodon_instances (instance, client_id, client_secret)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [instanceData.instance.toLowerCase(), instanceData.client_id, instanceData.client_secret]
      )

      if (!result.rows[0]) {
        throw new Error('Failed to create instance')
      }

      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgMastodonInstanceRepository.createInstance', 'Error creating instance', undefined, {
        instanceData,
        error
      })
      throw error
    }
  },

  /**
   * Met à jour une instance Mastodon
   */
  async updateInstance(
    instance: string,
    updates: {
      client_id?: string
      client_secret?: string
    }
  ): Promise<DBMastodonInstance> {
    try {
      const fields = Object.keys(updates)
      const setClauses = fields.map((field, i) => `${field} = $${i + 2}`).join(', ')
      const values = [instance.toLowerCase(), ...fields.map(field => updates[field as keyof typeof updates])]

      const sql = `
        UPDATE mastodon_instances
        SET ${setClauses}
        WHERE instance = $1
        RETURNING *
      `

      const result = await queryPublic<DBMastodonInstance>(sql, values)

      if (!result.rows[0]) {
        throw new Error('Instance not found')
      }

      return result.rows[0]
    } catch (error) {
      logger.logError('Repository', 'pgMastodonInstanceRepository.updateInstance', 'Error updating instance', undefined, {
        instance,
        updates,
        error
      })
      throw error
    }
  },

  /**
   * Supprime une instance Mastodon
   */
  async deleteInstance(instance: string): Promise<void> {
    try {
      await queryPublic('DELETE FROM mastodon_instances WHERE instance = $1', [instance.toLowerCase()])
    } catch (error) {
      logger.logError('Repository', 'pgMastodonInstanceRepository.deleteInstance', 'Error deleting instance', undefined, {
        instance,
        error
      })
      throw error
    }
  },

  /**
   * Récupère ou crée une instance Mastodon (helper pour auth.ts)
   */
  async getOrCreateInstance(
    instance: string,
    creator: () => Promise<{ client_id: string; client_secret: string }>
  ): Promise<DBMastodonInstance> {
    try {
      // Essayer de récupérer l'instance existante
      const existing = await this.getInstance(instance)
      if (existing) {
        return existing
      }

      // Créer une nouvelle instance
      const credentials = await creator()
      return await this.createInstance({
        instance,
        client_id: credentials.client_id,
        client_secret: credentials.client_secret,
      })
    } catch (error) {
      logger.logError('Repository', 'pgMastodonInstanceRepository.getOrCreateInstance', 'Error in getOrCreate', undefined, {
        instance,
        error
      })
      throw error
    }
  },
}
