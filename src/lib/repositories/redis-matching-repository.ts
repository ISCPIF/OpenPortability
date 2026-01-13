/**
 * Repository Redis pour les opérations de matching
 * Gère la récupération des handles Bluesky/Mastodon depuis les mappings Redis
 */

import redis from '../redis'
import logger from '../log_utils'

export interface SocialHandles {
  twitterId: string
  bluesky?: {
    username: string
    id?: string
  }
  mastodon?: {
    id: string
    username: string
    instance: string
  }
}

export const redisMatchingRepository = {
  /**
   * Récupère les handles Bluesky/Mastodon pour une liste de Twitter IDs
   * Utilise le pipeline Redis pour des performances optimales
   * 
   * @param twitterIds - Liste des Twitter IDs
   * @returns Map<twitterId, SocialHandles>
   */
  async getHandlesFromTwitterIds(twitterIds: string[]): Promise<Map<string, SocialHandles>> {
    try {
      if (twitterIds.length === 0) {
        return new Map()
      }

      logger.logDebug(
        'Repository',
        'redisMatchingRepository.getHandlesFromTwitterIds',
        `Fetching handles for ${twitterIds.length} Twitter IDs`
      )

      // Utiliser la méthode existante de redis.ts
      const rawMappings = await redis.batchGetSocialMappings(twitterIds)
      
      // Transformer en format SocialHandles
      const result = new Map<string, SocialHandles>()
      
      for (const [twitterId, mapping] of rawMappings) {
        const handles: SocialHandles = { twitterId }
        
        if (mapping.bluesky) {
          // Le format peut être juste le username ou un objet
          if (typeof mapping.bluesky === 'string') {
            handles.bluesky = { username: mapping.bluesky }
          } else {
            handles.bluesky = mapping.bluesky
          }
        }
        
        if (mapping.mastodon) {
          handles.mastodon = {
            id: mapping.mastodon.id,
            username: mapping.mastodon.username,
            instance: mapping.mastodon.instance,
          }
        }
        
        result.set(twitterId, handles)
      }

      logger.logDebug(
        'Repository',
        'redisMatchingRepository.getHandlesFromTwitterIds',
        `Found handles for ${result.size}/${twitterIds.length} Twitter IDs`
      )

      return result
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'redisMatchingRepository.getHandlesFromTwitterIds',
        errorString,
        'system',
        { twitterIdsCount: twitterIds.length }
      )
      throw error
    }
  },

  /**
   * Récupère les handles pour un seul Twitter ID
   * 
   * @param twitterId - Twitter ID
   * @returns SocialHandles ou null si non trouvé
   */
  async getHandlesFromTwitterId(twitterId: string): Promise<SocialHandles | null> {
    const result = await redisMatchingRepository.getHandlesFromTwitterIds([twitterId])
    return result.get(twitterId) || null
  },

  /**
   * Filtre une liste de Twitter IDs pour ne garder que ceux qui ont des handles
   * 
   * @param twitterIds - Liste des Twitter IDs
   * @param platform - Optionnel: filtrer par plateforme
   * @returns Liste des Twitter IDs avec handles
   */
  async filterTwitterIdsWithHandles(
    twitterIds: string[],
    platform?: 'bluesky' | 'mastodon'
  ): Promise<string[]> {
    const handles = await redisMatchingRepository.getHandlesFromTwitterIds(twitterIds)
    
    const filtered: string[] = []
    for (const [twitterId, socialHandles] of handles) {
      if (!platform) {
        // Garder si au moins une plateforme
        if (socialHandles.bluesky || socialHandles.mastodon) {
          filtered.push(twitterId)
        }
      } else if (platform === 'bluesky' && socialHandles.bluesky) {
        filtered.push(twitterId)
      } else if (platform === 'mastodon' && socialHandles.mastodon) {
        filtered.push(twitterId)
      }
    }
    
    return filtered
  },
}
