import { queryPublic } from '../../database'
import { redis } from '../../redis'
import { UserCompleteStats, GlobalStats } from '../../types/stats'
import logger from '../../log_utils'

/**
 * Repository pour les opérations de statistiques (schéma public)
 * Gère les stats utilisateur et globales avec caching Redis
 * 
 * Stratégie de cache:
 * - Redis first: Essayer de récupérer du cache Redis
 * - Fallback DB: Si cache miss, récupérer de la DB (RPCs)
 * - Cache update: Mettre en cache le résultat (TTL: 24h)
 */
export const pgStatsRepository = {
  /**
   * Récupère les stats complètes d'un utilisateur
   * Utilise deux RPCs différentes selon le statut onboarding
   * 
   * @param userId - UUID de l'utilisateur
   * @param has_onboard - true: appelle get_user_complete_stats, false: appelle get_user_complete_stats_from_sources
   * @returns Stats complètes de l'utilisateur
   */
  async getUserCompleteStats(userId: string, has_onboard: boolean): Promise<UserCompleteStats> {
    // 1. Essayer Redis d'abord
    try {
      const cacheKey = `user:stats:${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        logger.logInfo(
          'Repository',
          'pgStatsRepository.getUserCompleteStats',
          'User stats served from Redis cache',
          userId,
          { context: 'Redis cache hit' }
        )
        return JSON.parse(cached) as UserCompleteStats
      }
    } catch (redisError) {
      logger.logWarning(
        'Repository',
        'pgStatsRepository.getUserCompleteStats',
        'Redis unavailable, fallback to DB',
        userId,
        {
          context: 'Redis cache miss or error',
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
        }
      )
    }

    // 2. Fallback vers DB (appel RPC via queryPublic)
    let data: any
    try {
      if (!has_onboard) {
        // Utilisateur non onboardé: utiliser les sources comme base
        const result = await queryPublic(
          `SELECT public.get_user_complete_stats_from_sources($1) as stats`,
          [userId]
        )
        data = result.rows[0]?.stats
      } else {
        // Utilisateur onboardé: utiliser le cache utilisateur
        const result = await queryPublic(
          `SELECT public.get_user_complete_stats($1) as stats`,
          [userId]
        )
        data = result.rows[0]?.stats
      }

      if (!data) {
        throw new Error(`No stats returned for user ${userId}`)
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgStatsRepository.getUserCompleteStats',
        errorString,
        userId,
        { has_onboard }
      )
      throw error
    }

    // 3. Mettre en cache Redis (TTL: 24 heures)
    try {
      const cacheKey = `user:stats:${userId}`
      await redis.set(cacheKey, JSON.stringify(data), 86400)

      logger.logInfo(
        'Repository',
        'pgStatsRepository.getUserCompleteStats',
        'User stats cached in Redis',
        userId,
        { context: 'Database result cached for 24 hours' }
      )
    } catch (redisError) {
      logger.logWarning(
        'Repository',
        'pgStatsRepository.getUserCompleteStats',
        'Failed to cache in Redis',
        userId,
        {
          context: 'Redis caching failed, continuing without cache',
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
        }
      )
    }

    return data as UserCompleteStats
  },

  /**
   * Récupère les stats globales du système
   * Utilise Redis comme cache principal, fallback vers DB
   * 
   * @returns Stats globales du système
   */
  async getGlobalStats(): Promise<GlobalStats> {
    try {
      // 1. Essayer Redis d'abord
      const cached = await redis.get('stats:global')
      if (cached) {
        logger.logInfo(
          'Repository',
          'pgStatsRepository.getGlobalStats',
          'Global stats served from Redis cache',
          'system',
          { context: 'Redis cache hit for global stats' }
        )
        return JSON.parse(cached) as GlobalStats
      }

      // 2. Cache miss - récupérer depuis la DB
      logger.logInfo(
        'Repository',
        'pgStatsRepository.getGlobalStats',
        'Redis cache miss, fetching from database',
        'system',
        { context: 'Fallback to database for global stats' }
      )

      const result = await queryPublic(`SELECT public.get_global_stats() as stats`)
      const data = result.rows[0]?.stats

      if (!data) {
        throw new Error('No global stats returned from database')
      }

      // 3. Mettre en cache pour éviter les futurs cache miss
      await redis.set('stats:global', JSON.stringify(data), 86400)

      logger.logInfo(
        'Repository',
        'pgStatsRepository.getGlobalStats',
        'Global stats fetched from DB and cached',
        'system',
        { context: 'Database fallback successful, data cached in Redis' }
      )

      return data as GlobalStats
    } catch (redisError) {
      // 4. Si Redis complètement indisponible, aller directement en DB
      logger.logWarning(
        'Repository',
        'pgStatsRepository.getGlobalStats',
        'Redis unavailable, using database fallback',
        'system',
        {
          context: 'Redis error, direct database access',
          error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
        }
      )

      try {
        const result = await queryPublic(`SELECT public.get_global_stats() as stats`)
        const data = result.rows[0]?.stats

        if (!data) {
          throw new Error('No global stats returned from database')
        }

        return data as GlobalStats
      } catch (dbError) {
        const errorString = dbError instanceof Error ? dbError.message : String(dbError)
        logger.logError(
          'Repository',
          'pgStatsRepository.getGlobalStats',
          errorString,
          'system',
          { context: 'Database fallback also failed' }
        )
        throw dbError
      }
    }
  },

  /**
   * Récupère les stats globales depuis la table de cache
   * Utilisé comme fallback si les RPCs ne sont pas disponibles
   * 
   * @returns Stats globales ou null si pas de données
   */
  async getGlobalStatsFromCache(): Promise<GlobalStats | null> {
    try {
      const result = await queryPublic(
        `SELECT stats FROM global_stats_cache WHERE id = true`
      )

      if (!result.rows[0]) {
        logger.logWarning(
          'Repository',
          'pgStatsRepository.getGlobalStatsFromCache',
          'No data in global_stats_cache',
          'system',
          { context: 'Cache table empty or error' }
        )
        return null
      }

      return result.rows[0].stats as GlobalStats
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgStatsRepository.getGlobalStatsFromCache',
        errorString,
        'system',
        { context: 'Failed to read from global_stats_cache table' }
      )
      return null
    }
  },

  /**
   * Rafraîchit le cache des stats utilisateur
   * Appelle la RPC refresh_user_stats_cache qui met à jour user_stats_cache
   * 
   * @param userId - UUID de l'utilisateur
   * @param has_onboard - true: utilise la logique onboardée, false: utilise les sources
   */
  async refreshUserStatsCache(userId: string, has_onboard: boolean): Promise<void> {
    try {
      if (!has_onboard) {
        // Pour les utilisateurs non onboardés, appeler get_user_complete_stats_from_sources
        // qui met à jour le cache automatiquement
        await queryPublic(
          `SELECT public.get_user_complete_stats_from_sources($1)`,
          [userId]
        )
      } else {
        // Pour les utilisateurs onboardés, appeler refresh_user_stats_cache
        await queryPublic(
          `SELECT public.refresh_user_stats_cache($1)`,
          [userId]
        )
      }

      // Invalider le cache Redis après rafraîchissement
      try {
        const cacheKey = `user:stats:${userId}`
        await redis.del(cacheKey)
        logger.logInfo(
          'Repository',
          'pgStatsRepository.refreshUserStatsCache',
          'User stats cache refreshed and Redis invalidated',
          userId,
          { has_onboard }
        )
      } catch (redisError) {
        logger.logWarning(
          'Repository',
          'pgStatsRepository.refreshUserStatsCache',
          'Failed to invalidate Redis cache',
          userId,
          {
            error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
          }
        )
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgStatsRepository.refreshUserStatsCache',
        errorString,
        userId,
        { has_onboard }
      )
      throw error
    }
  },

  /**
   * Rafraîchit le cache des stats globales
   * Appelle la RPC refresh_global_stats_cache qui met à jour global_stats_cache
   */
  async refreshGlobalStatsCache(): Promise<void> {
    try {
      await queryPublic(`SELECT public.refresh_global_stats_cache()`)

      // Invalider le cache Redis après rafraîchissement
      try {
        await redis.del('stats:global')
        logger.logInfo(
          'Repository',
          'pgStatsRepository.refreshGlobalStatsCache',
          'Global stats cache refreshed and Redis invalidated',
          'system'
        )
      } catch (redisError) {
        logger.logWarning(
          'Repository',
          'pgStatsRepository.refreshGlobalStatsCache',
          'Failed to invalidate Redis cache',
          'system',
          {
            error: redisError instanceof Error ? redisError.message : 'Unknown Redis error',
          }
        )
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgStatsRepository.refreshGlobalStatsCache',
        errorString,
        'unknown'
      )
      throw error
    }
  },
}
