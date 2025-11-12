import { MatchingTarget, StoredProcedureTarget, MatchedFollower } from '../../types/matching'
import { queryPublic } from '../../database'
import { queryNextAuth } from '../../database'
import logger from '../../log_utils'

/**
 * Repository pour les opérations de matching (schéma public)
 * Gère les cibles suivables, les followers et les mises à jour de statut de suivi
 * 
 * Utilise:
 * - queryPublic: pour les tables public (sources_targets, sources_followers, nodes)
 * - queryNextAuth: pour les tables next-auth (users)
 */
export const pgMatchingRepository = {
  /**
   * Récupère les cibles suivables pour un utilisateur
   * Appelle la RPC get_followable_targets
   * 
   * @param userId - UUID de l'utilisateur
   * @param pageSize - Nombre d'éléments par page
   * @param pageNumber - Numéro de la page (0-indexed)
   * @returns { data, error } pattern pour compatibilité
   */
  async getFollowableTargets(
    userId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: StoredProcedureTarget[] | null; error: any }> {
    try {
      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getFollowableTargets',
        `Fetching followable targets - userId: ${userId}, pageSize: ${pageSize}, pageNumber: ${pageNumber}`
      )

      const result = await queryPublic(
        `SELECT * FROM public.get_followable_targets($1, $2, $3)`,
        [userId, pageSize, pageNumber]
      )

      const data = result.rows.map((row: any) => ({
        node_id: String(row.node_id),
        bluesky_handle: row.bluesky_handle ?? null,
        mastodon_id: row.mastodon_id ?? null,
        mastodon_username: row.mastodon_username ?? null,
        mastodon_instance: row.mastodon_instance ?? null,
        has_follow_bluesky: row.has_follow_bluesky ?? false,
        has_follow_mastodon: row.has_follow_mastodon ?? false,
        followed_at_bluesky: row.followed_at_bluesky ?? null,
        followed_at_mastodon: row.followed_at_mastodon ?? null,
        dismissed: row.dismissed ?? false,
        total_count: Number(row.total_count) ?? 0,
      })) as StoredProcedureTarget[]

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getFollowableTargets',
        `Retrieved ${data.length} followable targets`
      )

      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowableTargets',
        errorString,
        userId,
        { pageSize, pageNumber }
      )
      return { data: null, error }
    }
  },

  /**
   * Met à jour le statut de suivi pour une cible
   * 
   * @param userId - UUID de l'utilisateur (source_id)
   * @param targetId - ID du nœud cible (node_id, en BIGINT)
   * @param platform - Plateforme ('bluesky' ou 'mastodon')
   * @param success - Succès du suivi
   * @param error - Message d'erreur optionnel
   */
  async updateFollowStatus(
    userId: string,
    targetId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString()
      const nodeIdBigInt = BigInt(targetId)

      const updates =
        platform === 'bluesky'
          ? {
              has_follow_bluesky: success,
              followed_at_bluesky: success ? now : null,
            }
          : {
              has_follow_mastodon: success,
              followed_at_mastodon: success ? now : null,
            }

      const updateQuery =
        platform === 'bluesky'
          ? `UPDATE sources_targets SET has_follow_bluesky = $1, followed_at_bluesky = $2 WHERE source_id = $3 AND node_id = $4`
          : `UPDATE sources_targets SET has_follow_mastodon = $1, followed_at_mastodon = $2 WHERE source_id = $3 AND node_id = $4`

      await queryPublic(updateQuery, [
        updates[platform === 'bluesky' ? 'has_follow_bluesky' : 'has_follow_mastodon'],
        updates[platform === 'bluesky' ? 'followed_at_bluesky' : 'followed_at_mastodon'],
        userId,
        nodeIdBigInt,
      ])

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.updateFollowStatus',
        `Updated follow status - userId: ${userId}, targetId: ${targetId}, platform: ${platform}, success: ${success}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.updateFollowStatus',
        errorString,
        userId,
        { targetId, platform, success }
      )
      throw err
    }
  },

  /**
   * Met à jour le statut de suivi pour plusieurs cibles (batch)
   * 
   * @param userId - UUID de l'utilisateur (source_id)
   * @param targetIds - Tableau d'IDs de nœuds cibles (node_id)
   * @param platform - Plateforme ('bluesky' ou 'mastodon')
   * @param success - Succès du suivi
   * @param error - Message d'erreur optionnel
   */
  async updateFollowStatusBatch(
    userId: string,
    targetIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString()
      const nodeIdsBigInt = targetIds.map(id => BigInt(id))

      const updateQuery =
        platform === 'bluesky'
          ? `UPDATE sources_targets SET has_follow_bluesky = $1, followed_at_bluesky = $2 WHERE source_id = $3 AND node_id = ANY($4)`
          : `UPDATE sources_targets SET has_follow_mastodon = $1, followed_at_mastodon = $2 WHERE source_id = $3 AND node_id = ANY($4)`

      await queryPublic(updateQuery, [
        success,
        success ? now : null,
        userId,
        nodeIdsBigInt,
      ])

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.updateFollowStatusBatch',
        `Updated follow status for ${targetIds.length} targets - userId: ${userId}, platform: ${platform}, success: ${success}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.updateFollowStatusBatch',
        errorString,
        userId,
        { targetCount: targetIds.length, platform, success }
      )
      throw err
    }
  },

  /**
   * Met à jour le statut de suivi des followers pour plusieurs sources
   * 
   * @param followerTwitterId - ID Twitter du follower (node_id)
   * @param sourceTwitterIds - Tableau d'IDs Twitter des sources
   * @param platform - Plateforme ('bluesky' ou 'mastodon')
   * @param success - Succès du suivi
   * @param error - Message d'erreur optionnel
   */
  async updateSourcesFollowersStatusBatch(
    followerTwitterId: string,
    sourceTwitterIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      // Récupérer les UUIDs pour les IDs Twitter des sources
      const usersResult = await queryNextAuth(
        `SELECT id, twitter_id FROM "next-auth".users WHERE twitter_id = ANY($1)`,
        [sourceTwitterIds.map(id => BigInt(id))]
      )

      if (!usersResult.rows || usersResult.rows.length === 0) {
        logger.logWarning(
          'Repository',
          'pgMatchingRepository.updateSourcesFollowersStatusBatch',
          'No users found for Twitter IDs',
          'unknown',
          { followerTwitterId, sourceTwitterIds }
        )
        throw new Error('No users found for the given Twitter IDs')
      }

      const sourceUUIDs = usersResult.rows.map(row => row.id)
      const now = new Date().toISOString()
      const followerNodeId = BigInt(followerTwitterId)

      const updateQuery =
        platform === 'bluesky'
          ? `UPDATE sources_followers SET has_been_followed_on_bluesky = $1, followed_at_bluesky = $2 WHERE node_id = $3 AND source_id = ANY($4)`
          : `UPDATE sources_followers SET has_been_followed_on_mastodon = $1, followed_at_mastodon = $2 WHERE node_id = $3 AND source_id = ANY($4)`

      await queryPublic(updateQuery, [
        success,
        success ? now : null,
        followerNodeId,
        sourceUUIDs,
      ])

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.updateSourcesFollowersStatusBatch',
        `Updated followers status for ${sourceUUIDs.length} sources - followerTwitterId: ${followerTwitterId}, platform: ${platform}, success: ${success}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.updateSourcesFollowersStatusBatch',
        errorString,
        'unknown',
        { followerTwitterId, sourceTwitterIds, platform }
      )
      throw err
    }
  },

  /**
   * Met à jour le statut de suivi des followers pour une source
   * Wrapper autour de updateSourcesFollowersStatusBatch
   * 
   * @param followerTwitterId - ID Twitter du follower
   * @param sourceId - ID Twitter de la source
   * @param platform - Plateforme ('bluesky' ou 'mastodon')
   * @param success - Succès du suivi
   * @param error - Message d'erreur optionnel
   */
  async updateSourcesFollowersStatus(
    followerTwitterId: string,
    sourceId: string,
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    return pgMatchingRepository.updateSourcesFollowersStatusBatch(
      followerTwitterId,
      [sourceId],
      platform,
      success,
      error
    )
  },

  /**
   * Récupère les sources d'un follower
   * Appelle la RPC get_sources_from_follower
   * 
   * @param twitterId - ID Twitter du follower (node_id)
   * @param pageSize - Nombre d'éléments par page
   * @param pageNumber - Numéro de la page (0-indexed)
   * @returns { data, error } pattern pour compatibilité
   */
  async getSourcesFromFollower(
    twitterId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: MatchedFollower[] | null; error: any }> {
    try {
      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getSourcesFromFollower',
        `Fetching sources from follower - twitterId: ${twitterId}, pageSize: ${pageSize}, pageNumber: ${pageNumber}`
      )

      const result = await queryPublic(
        `SELECT * FROM public.get_sources_from_follower($1, $2, $3)`,
        [twitterId, pageSize, pageNumber]
      )

      const data = result.rows.map((row) => ({
        source_twitter_id: String(row.source_twitter_id),
        bluesky_handle: row.bluesky_handle ?? null,
        mastodon_id: row.mastodon_id ?? null,
        mastodon_username: row.mastodon_username ?? null,
        mastodon_instance: row.mastodon_instance ?? null,
        has_been_followed_on_bluesky: row.has_been_followed_on_bluesky ?? false,
        has_been_followed_on_mastodon: row.has_been_followed_on_mastodon ?? false,
        full_count: Number(row.total_count) ?? 0,
      })) as MatchedFollower[]

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getSourcesFromFollower',
        `Retrieved ${data.length} sources from follower`
      )

      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getSourcesFromFollower',
        errorString,
        'unknown',
        { twitterId, pageSize, pageNumber }
      )
      return { data: null, error }
    }
  },

  /**
   * Marque une cible comme ignorée (dismissed)
   * 
   * @param userId - UUID de l'utilisateur (source_id)
   * @param targetTwitterId - ID du nœud cible (node_id)
   */
  async ignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    try {
      const nodeIdBigInt = BigInt(targetTwitterId)

      await queryPublic(
        `UPDATE sources_targets SET dismissed = true WHERE source_id = $1 AND node_id = $2`,
        [userId, nodeIdBigInt]
      )

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.ignoreTarget',
        `Marked target as dismissed - userId: ${userId}, targetTwitterId: ${targetTwitterId}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.ignoreTarget',
        errorString,
        userId,
        { targetTwitterId }
      )
      throw err
    }
  },

  /**
   * Marque une cible comme non ignorée (undismissed)
   * 
   * @param userId - UUID de l'utilisateur (source_id)
   * @param targetTwitterId - ID du nœud cible (node_id)
   */
  async unignoreTarget(userId: string, targetTwitterId: string): Promise<void> {
    try {
      const nodeIdBigInt = BigInt(targetTwitterId)

      await queryPublic(
        `UPDATE sources_targets SET dismissed = false WHERE source_id = $1 AND node_id = $2`,
        [userId, nodeIdBigInt]
      )

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.unignoreTarget',
        `Marked target as not dismissed - userId: ${userId}, targetTwitterId: ${targetTwitterId}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.unignoreTarget',
        errorString,
        userId,
        { targetTwitterId }
      )
      throw err
    }
  },

  /**
   * Marque des nœuds comme indisponibles (batch)
   * 
   * @param nodeIds - Tableau d'IDs de nœuds (twitter_id)
   * @param platform - Plateforme ('bluesky' ou 'mastodon')
   * @param reason - Raison de l'indisponibilité
   */
  async markNodesAsUnavailableBatch(
    nodeIds: string[],
    platform: 'bluesky' | 'mastodon',
    reason: string
  ): Promise<void> {
    try {
      const nodeIdsBigInt = nodeIds.map(id => BigInt(id))

      const updateQuery =
        platform === 'bluesky'
          ? `UPDATE nodes SET bluesky_unavailable = true, failure_reason_bluesky = $1 WHERE twitter_id = ANY($2)`
          : `UPDATE nodes SET mastodon_unavailable = true, failure_reason_mastodon = $1 WHERE twitter_id = ANY($2)`

      await queryPublic(updateQuery, [reason, nodeIdsBigInt])

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.markNodesAsUnavailableBatch',
        `Marked ${nodeIds.length} nodes as unavailable - platform: ${platform}, reason: ${reason}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.markNodesAsUnavailableBatch',
        errorString,
        'unknown',
        { nodeCount: nodeIds.length, platform, reason }
      )
      throw err
    }
  },
}
