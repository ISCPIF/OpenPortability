// worker/src/repositories/sourcesRepository.ts
import { queryPublic } from '../database'

export const sourcesRepository = {
  /**
   * S'assure qu'un source existe pour un userId donné
   * Utilise INSERT ... ON CONFLICT DO NOTHING pour éviter les erreurs de duplication
   */
  async ensureExists(userId: string): Promise<void> {
    try {
      await queryPublic(
        `INSERT INTO sources (id) 
         VALUES ($1) 
         ON CONFLICT (id) DO NOTHING`,
        [userId]
      )
    } catch (error) {
      console.log('SourcesRepository', 'ensureExists', 'Error ensuring source exists', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }
}
