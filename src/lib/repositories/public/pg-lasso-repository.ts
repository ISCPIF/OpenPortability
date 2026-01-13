/**
 * Repository PostgreSQL pour les demandes de follow via lasso
 * Gère la table lasso_follow_requests
 */

import { queryPublic } from '../../database'
import logger from '../../log_utils'

export interface LassoFollowRequest {
  id: string
  user_id: string
  target_twitter_id: string
  platform: 'bluesky' | 'mastodon'
  status: 'pending' | 'completed' | 'failed'
  error_message?: string
  created_at: Date
  completed_at?: Date
}

export interface CreateLassoFollowRequest {
  user_id: string
  target_twitter_id: string
  platform: 'bluesky' | 'mastodon'
}

export const pgLassoRepository = {
  /**
   * Crée une nouvelle demande de follow via lasso
   * Utilise ON CONFLICT pour éviter les doublons
   */
  async createFollowRequest(request: CreateLassoFollowRequest): Promise<LassoFollowRequest | null> {
    try {
      const result = await queryPublic(
        `INSERT INTO lasso_follow_requests (user_id, target_twitter_id, platform)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, target_twitter_id, platform) 
         DO UPDATE SET 
           status = CASE 
             WHEN lasso_follow_requests.status = 'failed' THEN 'pending'
             ELSE lasso_follow_requests.status
           END,
           error_message = NULL,
           created_at = CASE 
             WHEN lasso_follow_requests.status = 'failed' THEN NOW()
             ELSE lasso_follow_requests.created_at
           END
         RETURNING *`,
        [request.user_id, request.target_twitter_id, request.platform]
      )

      if (result.rows.length === 0) {
        return null
      }

      return mapRowToLassoFollowRequest(result.rows[0])
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.createFollowRequest',
        errorString,
        request.user_id,
        { target_twitter_id: request.target_twitter_id, platform: request.platform }
      )
      throw error
    }
  },

  /**
   * Crée plusieurs demandes de follow en batch
   */
  async createFollowRequestsBatch(requests: CreateLassoFollowRequest[]): Promise<number> {
    if (requests.length === 0) return 0

    try {
      // Construire les valeurs pour l'INSERT batch
      const values: any[] = []
      const placeholders: string[] = []
      
      requests.forEach((req, index) => {
        const offset = index * 3
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`)
        values.push(req.user_id, req.target_twitter_id, req.platform)
      })

      const result = await queryPublic(
        `INSERT INTO lasso_follow_requests (user_id, target_twitter_id, platform)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (user_id, target_twitter_id, platform) 
         DO UPDATE SET 
           status = CASE 
             WHEN lasso_follow_requests.status = 'failed' THEN 'pending'
             ELSE lasso_follow_requests.status
           END,
           error_message = NULL
         RETURNING id`,
        values
      )

      logger.logDebug(
        'Repository',
        'pgLassoRepository.createFollowRequestsBatch',
        `Created/updated ${result.rows.length} follow requests`
      )

      return result.rows.length
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.createFollowRequestsBatch',
        errorString,
        requests[0]?.user_id || 'unknown',
        { requestCount: requests.length }
      )
      throw error
    }
  },

  /**
   * Met à jour le statut d'une demande de follow
   */
  async updateFollowRequestStatus(
    userId: string,
    targetTwitterId: string,
    platform: 'bluesky' | 'mastodon',
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      await queryPublic(
        `UPDATE lasso_follow_requests 
         SET status = $1, 
             error_message = $2,
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END
         WHERE user_id = $3 AND target_twitter_id = $4 AND platform = $5`,
        [status, errorMessage || null, userId, targetTwitterId, platform]
      )

      logger.logDebug(
        'Repository',
        'pgLassoRepository.updateFollowRequestStatus',
        `Updated status to ${status} for ${targetTwitterId} on ${platform}`
      )
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.updateFollowRequestStatus',
        errorString,
        userId,
        { targetTwitterId, platform, status }
      )
      throw error
    }
  },

  /**
   * Met à jour le statut de plusieurs demandes en batch
   */
  async updateFollowRequestStatusBatch(
    userId: string,
    targetTwitterIds: string[],
    platform: 'bluesky' | 'mastodon',
    status: 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    if (targetTwitterIds.length === 0) return

    try {
      await queryPublic(
        `UPDATE lasso_follow_requests 
         SET status = $1, 
             error_message = $2,
             completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE NULL END
         WHERE user_id = $3 AND platform = $4 AND target_twitter_id = ANY($5)`,
        [status, errorMessage || null, userId, platform, targetTwitterIds]
      )

      logger.logDebug(
        'Repository',
        'pgLassoRepository.updateFollowRequestStatusBatch',
        `Updated ${targetTwitterIds.length} requests to ${status} on ${platform}`
      )
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.updateFollowRequestStatusBatch',
        errorString,
        userId,
        { targetCount: targetTwitterIds.length, platform, status }
      )
      throw error
    }
  },

  /**
   * Récupère les demandes de follow pour un utilisateur
   */
  async getFollowRequests(
    userId: string,
    status?: 'pending' | 'completed' | 'failed',
    limit: number = 100
  ): Promise<LassoFollowRequest[]> {
    try {
      let query = `SELECT * FROM lasso_follow_requests WHERE user_id = $1`
      const params: any[] = [userId]

      if (status) {
        query += ` AND status = $2`
        params.push(status)
      }

      query += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
      params.push(limit)

      const result = await queryPublic(query, params)

      return result.rows.map(mapRowToLassoFollowRequest)
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.getFollowRequests',
        errorString,
        userId,
        { status, limit }
      )
      throw error
    }
  },

  /**
   * Compte les demandes par statut pour un utilisateur
   */
  async getFollowRequestStats(userId: string): Promise<{
    pending: number
    completed: number
    failed: number
    total: number
  }> {
    try {
      const result = await queryPublic(
        `SELECT 
           COUNT(*) FILTER (WHERE status = 'pending') as pending,
           COUNT(*) FILTER (WHERE status = 'completed') as completed,
           COUNT(*) FILTER (WHERE status = 'failed') as failed,
           COUNT(*) as total
         FROM lasso_follow_requests 
         WHERE user_id = $1`,
        [userId]
      )

      const row = result.rows[0]
      return {
        pending: parseInt(row.pending) || 0,
        completed: parseInt(row.completed) || 0,
        failed: parseInt(row.failed) || 0,
        total: parseInt(row.total) || 0,
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.getFollowRequestStats',
        errorString,
        userId
      )
      return { pending: 0, completed: 0, failed: 0, total: 0 }
    }
  },

  /**
   * Récupère toutes les demandes de follow groupées par statut en une seule requête
   * Optimisation pour éviter 3 appels séparés
   */
  async getFollowRequestsGrouped(
    userId: string,
    limits: { completed?: number; failed?: number; pending?: number } = {}
  ): Promise<{
    completed: LassoFollowRequest[]
    failed: LassoFollowRequest[]
    pending: LassoFollowRequest[]
  }> {
    const completedLimit = limits.completed ?? 100
    const failedLimit = limits.failed ?? 50
    const pendingLimit = limits.pending ?? 50

    try {
      // Use UNION ALL to get all statuses in one query with per-status limits
      const result = await queryPublic(
        `(
          SELECT *, 'completed' as query_status FROM lasso_follow_requests 
          WHERE user_id = $1 AND status = 'completed'
          ORDER BY created_at DESC LIMIT $2
        )
        UNION ALL
        (
          SELECT *, 'failed' as query_status FROM lasso_follow_requests 
          WHERE user_id = $1 AND status = 'failed'
          ORDER BY created_at DESC LIMIT $3
        )
        UNION ALL
        (
          SELECT *, 'pending' as query_status FROM lasso_follow_requests 
          WHERE user_id = $1 AND status = 'pending'
          ORDER BY created_at DESC LIMIT $4
        )`,
        [userId, completedLimit, failedLimit, pendingLimit]
      )

      const completed: LassoFollowRequest[] = []
      const failed: LassoFollowRequest[] = []
      const pending: LassoFollowRequest[] = []

      for (const row of result.rows) {
        const request = mapRowToLassoFollowRequest(row)
        switch (row.status) {
          case 'completed':
            completed.push(request)
            break
          case 'failed':
            failed.push(request)
            break
          case 'pending':
            pending.push(request)
            break
        }
      }

      return { completed, failed, pending }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.getFollowRequestsGrouped',
        errorString,
        userId,
        { limits }
      )
      return { completed: [], failed: [], pending: [] }
    }
  },

  /**
   * Supprime les demandes de follow pour un utilisateur
   */
  async deleteFollowRequests(
    userId: string,
    targetTwitterIds?: string[]
  ): Promise<number> {
    try {
      let query = `DELETE FROM lasso_follow_requests WHERE user_id = $1`
      const params: any[] = [userId]

      if (targetTwitterIds && targetTwitterIds.length > 0) {
        query += ` AND target_twitter_id = ANY($2)`
        params.push(targetTwitterIds)
      }

      query += ` RETURNING id`

      const result = await queryPublic(query, params)

      logger.logDebug(
        'Repository',
        'pgLassoRepository.deleteFollowRequests',
        `Deleted ${result.rows.length} follow requests`
      )

      return result.rows.length
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgLassoRepository.deleteFollowRequests',
        errorString,
        userId,
        { targetCount: targetTwitterIds?.length }
      )
      throw error
    }
  },
}

function mapRowToLassoFollowRequest(row: any): LassoFollowRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    target_twitter_id: String(row.target_twitter_id),
    platform: row.platform,
    status: row.status,
    error_message: row.error_message || undefined,
    created_at: new Date(row.created_at),
    completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
  }
}
