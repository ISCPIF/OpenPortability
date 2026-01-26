import { MatchingTarget, StoredProcedureTarget, MatchedFollower, FollowerOfSource } from '../../types/matching'
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

      // Store followed_at even on failure to mark as "attempted"
      // This allows frontend to distinguish "never tried" from "tried and failed"
      const updateQuery =
        platform === 'bluesky'
          ? `UPDATE sources_targets SET has_follow_bluesky = $1, followed_at_bluesky = $2 WHERE source_id = $3 AND node_id = ANY($4)`
          : `UPDATE sources_targets SET has_follow_mastodon = $1, followed_at_mastodon = $2 WHERE source_id = $3 AND node_id = ANY($4)`

      await queryPublic(updateQuery, [
        success,
        now, // Always store timestamp to mark as attempted
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
   * Met à jour le statut de suivi dans sources_followers pour un utilisateur non-onboarded
   * Utilisé quand l'utilisateur suit des comptes via leur node_id (twitter_id des cibles)
   * 
   * @param followerTwitterId - ID Twitter du follower (l'utilisateur qui suit)
   * @param targetNodeIds - Tableau des node_id (twitter_id) des cibles suivies
   * @param platform - Plateforme ('bluesky' ou 'mastodon')
   * @param success - Succès du suivi
   * @param error - Message d'erreur optionnel
   */
  async updateSourcesFollowersByNodeIds(
    followerTwitterId: string,
    targetNodeIds: string[],
    platform: 'bluesky' | 'mastodon',
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      if (!targetNodeIds || targetNodeIds.length === 0) {
        logger.logWarning(
          'Repository',
          'pgMatchingRepository.updateSourcesFollowersByNodeIds',
          'No target node IDs provided',
          'unknown',
          { followerTwitterId }
        )
        return
      }

      // Convertir les node_ids en BigInt pour la requête
      const targetNodeIdsBigInt = targetNodeIds.map(id => BigInt(id))
      const followerNodeId = BigInt(followerTwitterId)
      const now = new Date().toISOString()

      // Trouver les source_id (UUIDs) correspondant aux node_id des cibles
      // Le mapping twitter_id -> user_id est dans "next-auth".users
      // sources.id = users.id (FK constraint)
      const sourcesResult = await queryNextAuth(
        `SELECT u.id as source_id, u.twitter_id as node_id
         FROM "next-auth".users u
         JOIN sources s ON s.id = u.id
         WHERE u.twitter_id = ANY($1)`,
        [targetNodeIdsBigInt]
      )

      if (!sourcesResult.rows || sourcesResult.rows.length === 0) {
        logger.logWarning(
          'Repository',
          'pgMatchingRepository.updateSourcesFollowersByNodeIds',
          'No sources found for target node IDs',
          'unknown',
          { followerTwitterId, targetNodeIds }
        )
        return
      }

      const sourceUUIDs = sourcesResult.rows.map(row => row.source_id)

      // Store followed_at even on failure to mark as "attempted"
      // This allows frontend to distinguish "never tried" from "tried and failed"
      const updateQuery =
        platform === 'bluesky'
          ? `UPDATE sources_followers SET has_been_followed_on_bluesky = $1, followed_at_bluesky = $2 WHERE node_id = $3 AND source_id = ANY($4)`
          : `UPDATE sources_followers SET has_been_followed_on_mastodon = $1, followed_at_mastodon = $2 WHERE node_id = $3 AND source_id = ANY($4)`

      await queryPublic(updateQuery, [
        success,
        now, // Always store timestamp to mark as attempted
        followerNodeId,
        sourceUUIDs,
      ])

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.updateSourcesFollowersByNodeIds',
        `Updated sources_followers for non-onboarded user - followerTwitterId: ${followerTwitterId}, targetCount: ${sourceUUIDs.length}, platform: ${platform}, success: ${success}`
      )
    } catch (err) {
      const errorString = err instanceof Error ? err.message : String(err)
      logger.logError(
        'Repository',
        'pgMatchingRepository.updateSourcesFollowersByNodeIds',
        errorString,
        'unknown',
        { followerTwitterId, targetNodeIds, platform }
      )
      throw err
    }
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

      const data = result.rows.map((row: { source_twitter_id: string; bluesky_handle?: string; mastodon_id?: string; mastodon_username?: string; mastodon_instance?: string; has_been_followed_on_bluesky?: boolean; has_been_followed_on_mastodon?: boolean; followed_at_bluesky?: string; followed_at_mastodon?: string; total_count?: number }) => ({
        source_twitter_id: String(row.source_twitter_id),
        bluesky_handle: row.bluesky_handle ?? null,
        mastodon_id: row.mastodon_id ?? null,
        mastodon_username: row.mastodon_username ?? null,
        mastodon_instance: row.mastodon_instance ?? null,
        has_been_followed_on_bluesky: row.has_been_followed_on_bluesky ?? false,
        has_been_followed_on_mastodon: row.has_been_followed_on_mastodon ?? false,
        followed_at_bluesky: row.followed_at_bluesky ?? null,
        followed_at_mastodon: row.followed_at_mastodon ?? null,
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
      // Skip marking nodes as unavailable for user-side token errors
      // These are not issues with the target node, but with the user's authentication
      const userTokenErrors = [
        '"exp" claim timestamp check failed',
        'token expired',
        'invalid token',
        'authentication required',
        'unauthorized',
        'session expired',
      ]
      
      const reasonLower = reason.toLowerCase()
      const isUserTokenError = userTokenErrors.some(err => reasonLower.includes(err.toLowerCase()))
      
      if (isUserTokenError) {
        logger.logDebug(
          'Repository',
          'pgMatchingRepository.markNodesAsUnavailableBatch',
          `Skipping marking ${nodeIds.length} nodes as unavailable - reason is a user token error: ${reason}`
        )
        return
      }

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


  /**
   * Récupère les sources qui suivent un target (node_id)
   * Pour les utilisateurs non-onboarded qui ont un twitter_id mais pas de source_id
   * Appelle la RPC get_sources_of_target
   * 
   * @param nodeId - ID du nœud target (twitter_id en BIGINT)
   * @param pageSize - Nombre d'éléments par page
   * @param pageNumber - Numéro de la page (0-indexed)
   * @returns { data, error } pattern pour compatibilité
   */
  async getSourcesOfTarget(
    nodeId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: { source_id: string; total_count: number }[] | null; error: any }> {
    try {
      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getSourcesOfTarget',
        `Fetching sources of target - nodeId: ${nodeId}, pageSize: ${pageSize}, pageNumber: ${pageNumber}`
      )

      const result = await queryPublic(
        `SELECT * FROM public.get_sources_of_target($1, $2, $3)`,
        [nodeId, pageSize, pageNumber]
      )

      const data = result.rows.map((row: any) => ({
        source_id: String(row.source_id),
        total_count: Number(row.total_count) ?? 0,
      }))

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getSourcesOfTarget',
        `Retrieved ${data.length} sources of target`
      )

      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getSourcesOfTarget',
        errorString,
        'system',
        { nodeId, pageSize, pageNumber }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les sources qui suivent un target avec leur twitter_id
   * Fait une jointure avec next-auth.users pour récupérer le twitter_id de chaque source
   * 
   * @param nodeId - ID du nœud target (twitter_id en BIGINT)
   * @param pageSize - Nombre d'éléments par page
   * @param pageNumber - Numéro de la page (0-indexed)
   * @returns { data, error } pattern pour compatibilité
   */
  async getSourcesOfTargetWithTwitterId(
    nodeId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: { source_id: string; twitter_id: string; total_count: number }[] | null; error: any }> {
    try {
      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getSourcesOfTargetWithTwitterId',
        `Fetching sources of target with twitter_id - nodeId: ${nodeId}, pageSize: ${pageSize}, pageNumber: ${pageNumber}`
      )

      // First get the sources from the RPC
      const sourcesResult = await queryPublic(
        `SELECT * FROM public.get_sources_of_target($1, $2, $3)`,
        [nodeId, pageSize, pageNumber]
      )

      if (sourcesResult.rows.length === 0) {
        return { data: [], error: null }
      }

      // Extract source_ids
      const sourceIds = sourcesResult.rows.map((row: any) => row.source_id)
      const totalCount = sourcesResult.rows[0]?.total_count || sourcesResult.rows.length

      // Join with next-auth.users to get twitter_id
      const usersResult = await queryNextAuth(
        `SELECT id, twitter_id FROM "next-auth".users WHERE id = ANY($1::uuid[]) AND twitter_id IS NOT NULL`,
        [sourceIds]
      )

      // Create a map of source_id -> twitter_id
      const twitterIdMap = new Map<string, string>()
      usersResult.rows.forEach((row: any) => {
        if (row.twitter_id) {
          twitterIdMap.set(row.id, String(row.twitter_id))
        }
      })

      // Combine the data
      const data = sourcesResult.rows
        .filter((row: any) => twitterIdMap.has(row.source_id))
        .map((row: any) => ({
          source_id: String(row.source_id),
          twitter_id: twitterIdMap.get(row.source_id)!,
          total_count: Number(totalCount),
        }))

      logger.logDebug(
        'Repository',
        'pgMatchingRepository.getSourcesOfTargetWithTwitterId',
        `Retrieved ${data.length} sources of target with twitter_id`
      )

      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getSourcesOfTargetWithTwitterId',
        errorString,
        'system',
        { nodeId, pageSize, pageNumber }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère uniquement les twitter_ids des cibles suivables (node_id)
   * Utilisé pour le endpoint personal-hashes (RGPD-friendly)
   * 
   * @param userId - UUID de l'utilisateur
   * @returns { data: string[], error } - Liste des twitter_ids
   */
  async getFollowableTargetsTwitterIds(
    userId: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      const result = await queryPublic(
        `SELECT DISTINCT node_id::text as twitter_id 
         FROM public.sources_targets 
         WHERE source_id = $1`,
        [userId]
      )

      const data = result.rows.map((row: any) => row.twitter_id)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowableTargetsTwitterIds',
        errorString,
        userId
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les twitter_ids des sources pour un follower (non-onboarded user)
   * Le follower est identifié par son twitter_id dans sources_followers
   * 
   * @param followerTwitterId - twitter_id du follower
   * @returns { data: string[], error } - Liste des twitter_ids des sources
   */
  async getSourcesTwitterIdsForFollower(
    followerTwitterId: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      // sources_followers: source_id est l'id de la source (dans twitter_bluesky_users ou twitter_mastodon_users)
      // node_id est le twitter_id du follower
      // On doit joindre avec twitter_bluesky_users et twitter_mastodon_users pour obtenir les twitter_id des sources
      const result = await queryPublic(
        `SELECT DISTINCT COALESCE(tbu.twitter_id, tmu.twitter_id)::text as twitter_id
         FROM public.sources_followers sf
         LEFT JOIN public.twitter_bluesky_users tbu ON tbu.id = sf.source_id
         LEFT JOIN public.twitter_mastodon_users tmu ON tmu.id = sf.source_id
         WHERE sf.node_id = $1::bigint
           AND (tbu.twitter_id IS NOT NULL OR tmu.twitter_id IS NOT NULL)`,
        [followerTwitterId]
      )

      const data = result.rows.map((row: any) => row.twitter_id)

      console.log("📊 [getSourcesTwitterIdsForFollower] Found", data.length, "sources for follower", followerTwitterId)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getSourcesTwitterIdsForFollower',
        errorString,
        'system',
        { followerTwitterId }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les twitter_ids des followers pour une source (onboarded user)
   * 
   * @param userId - UUID de l'utilisateur source
   * @returns { data: string[], error } - Liste des twitter_ids des followers
   */
  async getFollowersTwitterIdsForSource(
    userId: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      // First get the user's source_id from twitter_bluesky_users or twitter_mastodon_users
      const userResult = await queryNextAuth(
        `SELECT twitter_id FROM "next-auth".users WHERE id = $1`,
        [userId]
      )

      if (userResult.rows.length === 0 || !userResult.rows[0].twitter_id) {
        return { data: [], error: null }
      }

      const sourceTwitterId = String(userResult.rows[0].twitter_id)

      // Get the source_id from twitter_bluesky_users or twitter_mastodon_users
      const sourceIdResult = await queryPublic(
        `SELECT id as source_id FROM public.twitter_bluesky_users WHERE twitter_id = $1
         UNION
         SELECT id as source_id FROM public.twitter_mastodon_users WHERE twitter_id = $1
         LIMIT 1`,
        [sourceTwitterId]
      )

      if (sourceIdResult.rows.length === 0) {
        console.log("📊 [getFollowersTwitterIdsForSource] No source_id found for twitter_id", sourceTwitterId)
        return { data: [], error: null }
      }

      const sourceId = sourceIdResult.rows[0].source_id

      // Get followers (node_id) from sources_followers where source_id matches
      // node_id in sources_followers is the twitter_id of the follower
      const result = await queryPublic(
        `SELECT DISTINCT node_id::text as twitter_id 
         FROM public.sources_followers 
         WHERE source_id = $1`,
        [sourceId]
      )

      const data = result.rows.map((row: any) => row.twitter_id)
      console.log("📊 [getFollowersTwitterIdsForSource] Found", data.length, "followers for source", sourceTwitterId)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowersTwitterIdsForSource',
        errorString,
        userId
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les twitter_ids des sources qui suivent un target (non-onboarded user)
   * 
   * @param targetTwitterId - twitter_id du target
   * @returns { data: string[], error } - Liste des twitter_ids des sources
   */
  async getSourcesOfTargetTwitterIds(
    targetTwitterId: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      // Get sources from sources_targets where node_id (target) matches
      // We need to get the twitter_id of the sources (users)
      const result = await queryPublic(
        `SELECT DISTINCT st.source_id
         FROM public.sources_targets st
         WHERE st.node_id = $1`,
        [targetTwitterId]
      )

      if (result.rows.length === 0) {
        return { data: [], error: null }
      }

      // Get twitter_ids for these source_ids
      const sourceIds = result.rows.map((row: any) => row.source_id)
      const usersResult = await queryNextAuth(
        `SELECT twitter_id::text as twitter_id 
         FROM "next-auth".users 
         WHERE id = ANY($1::uuid[]) AND twitter_id IS NOT NULL`,
        [sourceIds]
      )

      const data = usersResult.rows.map((row: any) => row.twitter_id)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getSourcesOfTargetTwitterIds',
        errorString,
        'system',
        { targetTwitterId }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère directement les coord_hashes des followers pour une source (onboarded user)
   * Utilise une fonction RPC avec l'UUID de l'utilisateur (session.user.id)
   * 
   * @param sourceUuid - UUID de l'utilisateur (session.user.id)
   * @returns { data: string[], error } - Liste des coord_hashes des followers dans le graphe
   */
  async getFollowerHashesForSourceUuid(
    sourceUuid: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      const result = await queryPublic(
        `SELECT coord_hash FROM public.get_follower_hashes_for_source_uuid($1::uuid)`,
        [sourceUuid]
      )

      const data = result.rows.map((row: any) => row.coord_hash)
      console.log("📊 [getFollowerHashesForSourceUuid] Found", data.length, "follower hashes for source", sourceUuid)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowerHashesForSourceUuid',
        errorString,
        'system',
        { sourceUuid }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les coord_hashes des "effective followers" pour une source (onboarded user)
   * Ce sont les followers qui ont effectivement suivi l'utilisateur via OpenPortability
   * (has_follow_bluesky = TRUE OR has_follow_mastodon = TRUE dans sources_targets)
   * 
   * @param twitterId - twitter_id de l'utilisateur (p_twitter_id)
   * @returns { data: string[], error } - Liste des coord_hashes des effective followers
   */
  async getEffectiveFollowerHashesForSource(
    twitterId: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      // Query similaire à get_effective_followers mais retourne les coord_hashes
      // Les effective followers sont les source_id dans sources_targets qui ont
      // has_follow_bluesky = TRUE OR has_follow_mastodon = TRUE pour le node_id = twitterId
      const result = await queryPublic(
        `SELECT DISTINCT 
           CONCAT(gn.x::text, '_', gn.y::text) as coord_hash
         FROM public.sources_targets st
         INNER JOIN "next-auth".users u ON u.id = st.source_id
         INNER JOIN public.graph_nodes_03_11_25 gn ON gn.id = u.twitter_id
         WHERE st.node_id = $1::bigint
           AND (st.has_follow_bluesky = TRUE OR st.has_follow_mastodon = TRUE)`,
        [twitterId]
      )

      // Format coord_hash avec 6 décimales comme le frontend
      const data = result.rows.map((row: any) => {
        const parts = row.coord_hash.split('_')
        const x = parseFloat(parts[0])
        const y = parseFloat(parts[1])
        return `${x.toFixed(6)}_${y.toFixed(6)}`
      })
      
      console.log("📊 [getEffectiveFollowerHashesForSource] Found", data.length, "effective follower hashes for twitter_id", twitterId)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getEffectiveFollowerHashesForSource',
        errorString,
        'system',
        { twitterId }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère directement les coord_hashes des sources (followings) pour un follower
   * Utilise une fonction RPC pour combiner toutes les requêtes en une seule
   * 
   * @param followerTwitterId - twitter_id du follower
   * @returns { data: string[], error } - Liste des coord_hashes des followings dans le graphe
   */
  async getFollowingHashesForFollower(
    followerTwitterId: string
  ): Promise<{ data: string[] | null; error: any }> {
    try {
      const result = await queryPublic(
        `SELECT coord_hash FROM public.get_following_hashes_for_follower($1::bigint)`,
        [followerTwitterId]
      )

      const data = result.rows.map((row: any) => row.coord_hash)
      console.log("📊 [getFollowingHashesForFollower] Found", data.length, "following hashes for follower", followerTwitterId)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowingHashesForFollower',
        errorString,
        'system',
        { followerTwitterId }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère directement les coord_hashes des sources (followers) pour un target (non-onboarded user)
   * Utilise une fonction RPC pour combiner toutes les requêtes en une seule
   * 
   * @param targetTwitterId - twitter_id du target
   * @param pageSize - Nombre d'éléments par page
   * @param pageNumber - Numéro de la page (0-indexed)
   * @returns { data: { hashes, total_count }, error }
   */
  async getSourcesOfTargetWithHashes(
    targetTwitterId: string,
    pageSize: number = 1000,
    pageNumber: number = 0
  ): Promise<{ data: { hashes: string[]; total_count: number } | null; error: any }> {
    try {
      const result = await queryPublic(
        `SELECT coord_hash, total_count FROM public.get_sources_of_target_with_hashes($1::bigint, $2, $3)`,
        [targetTwitterId, pageSize, pageNumber]
      )

      const hashes = result.rows.map((row: any) => row.coord_hash)
      const total_count = result.rows[0]?.total_count || 0

      console.log("📊 [getSourcesOfTargetWithHashes] Found", hashes.length, "source hashes for target", targetTwitterId)
      return { data: { hashes, total_count }, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getSourcesOfTargetWithHashes',
        errorString,
        'system',
        { targetTwitterId, pageSize, pageNumber }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère directement les coord_hashes des followings pour un utilisateur onboarded
   * Fait la jointure sources_targets -> graph_nodes en une seule requête SQL
   * Optimisation pour éviter 2 appels séquentiels
   * 
   * @param userId - UUID de l'utilisateur (source_id)
   * @returns { data: FollowingHashWithStatus[], error } - Liste des coord_hashes avec statut de suivi et node_id pour matching lookup
   */
  async getFollowingHashesForOnboardedUser(
    userId: string
  ): Promise<{ data: { coord_hash: string; node_id: string; has_follow_bluesky: boolean; has_follow_mastodon: boolean }[] | null; error: any }> {
    try {
      // Single query: join sources_targets with graph_nodes to get hashes, node_id and follow status
      const result = await queryPublic(
        `SELECT CONCAT(
           ROUND(gn.x::numeric, 6)::text, '_', 
           ROUND(gn.y::numeric, 6)::text
         ) as coord_hash,
         st.node_id::text as node_id,
         COALESCE(st.has_follow_bluesky, false) as has_follow_bluesky,
         COALESCE(st.has_follow_mastodon, false) as has_follow_mastodon
         FROM public.sources_targets st
         INNER JOIN graph_nodes_03_11_25 gn ON gn.id = st.node_id
         WHERE st.source_id = $1`,
        [userId]
      )

      const data = result.rows.map((row: any) => ({
        coord_hash: row.coord_hash,
        node_id: row.node_id,
        has_follow_bluesky: row.has_follow_bluesky,
        has_follow_mastodon: row.has_follow_mastodon,
      }))
      const followedCount = data.filter((d: { has_follow_bluesky: boolean; has_follow_mastodon: boolean }) => d.has_follow_bluesky || d.has_follow_mastodon).length
      console.log("📊 [getFollowingHashesForOnboardedUser] Found", data.length, "following hashes for user", userId, `(${followedCount} already followed)`)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowingHashesForOnboardedUser',
        errorString,
        'system',
        { userId }
      )
      return { data: null, error }
    }
  },
  /**
   * Récupère les coord_hashes à partir des node_ids
   * Utilisé pour mettre à jour le cache client après un follow
   * 
   * @param nodeIds - Liste des node_ids
   * @returns Map<node_id, coord_hash>
   */
  async getCoordHashesByNodeIds(
    nodeIds: string[]
  ): Promise<{ data: Map<string, string> | null; error: any }> {
    if (nodeIds.length === 0) {
      return { data: new Map(), error: null };
    }
    
    try {
      // Convert string node_ids to bigints for the query
      const nodeIdsBigInt = nodeIds.map(id => BigInt(id));
      
      const result = await queryPublic(
        `SELECT 
           id::text as node_id,
           CONCAT(
             ROUND(x::numeric, 6)::text, '_', 
             ROUND(y::numeric, 6)::text
           ) as coord_hash
         FROM graph_nodes_03_11_25
         WHERE id = ANY($1::bigint[])`,
        [nodeIdsBigInt]
      );

      const hashMap = new Map<string, string>();
      for (const row of result.rows) {
        hashMap.set(row.node_id, row.coord_hash);
      }
      
      return { data: hashMap, error: null };
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      logger.logError(
        'Repository',
        'pgMatchingRepository.getCoordHashesByNodeIds',
        errorString,
        'system',
        { nodeIdsCount: nodeIds.length }
      );
      return { data: null, error };
    }
  },

  /**
   * Récupère les statistiques de communautés des followers pour un utilisateur
   * Calcule directement les pourcentages côté serveur pour optimiser le mobile
   * 
   * @param sourceUuid - UUID de l'utilisateur (session.user.id)
   * @returns { data: CommunityStats, error }
   */
  async getFollowerCommunityStats(
    sourceUuid: string
  ): Promise<{ 
    data: { 
      communities: { community: number; count: number; percentage: number }[];
      totalFollowersInGraph: number;
    } | null; 
    error: any 
  }> {
    try {
      // Single query: get community distribution of followers
      // Join sources_followers with graph_nodes to get community info
      const result = await queryPublic(
        `SELECT 
           (gn.community % 10) as community,
           COUNT(*) as count
         FROM public.sources_followers sf
         INNER JOIN graph_nodes_03_11_25 gn ON gn.id = sf.node_id
         WHERE sf.source_id = $1
         GROUP BY (gn.community % 10)
         ORDER BY count DESC`,
        [sourceUuid]
      )

      const totalFollowersInGraph = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0)
      
      const communities = result.rows.map((row: any) => ({
        community: parseInt(row.community),
        count: parseInt(row.count),
        percentage: totalFollowersInGraph > 0 
          ? parseFloat(((parseInt(row.count) / totalFollowersInGraph) * 100).toFixed(1))
          : 0
      }))

      console.log("📊 [getFollowerCommunityStats] Found", communities.length, "communities for", totalFollowersInGraph, "followers of user", sourceUuid)
      return { data: { communities, totalFollowersInGraph }, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowerCommunityStats',
        errorString,
        'system',
        { sourceUuid }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les statistiques de communautés des followers pour un utilisateur non-onboarded
   * Utilise sources_targets (où l'utilisateur est la cible)
   * 
   * @param targetTwitterId - twitter_id de l'utilisateur
   * @returns { data: CommunityStats, error }
   */
  async getFollowerCommunityStatsForTarget(
    targetTwitterId: string
  ): Promise<{ 
    data: { 
      communities: { community: number; count: number; percentage: number }[];
      totalFollowersInGraph: number;
    } | null; 
    error: any 
  }> {
    try {
      // For non-onboarded users: their "followers" are sources who have them as targets
      // We need to find sources (onboarded users) who follow this target
      const result = await queryPublic(
        `SELECT 
           (gn.community % 10) as community,
           COUNT(*) as count
         FROM public.sources_targets st
         INNER JOIN "next-auth".users u ON u.id = st.source_id
         INNER JOIN graph_nodes_03_11_25 gn ON gn.id = u.twitter_id
         WHERE st.node_id IN (
           SELECT id FROM graph_nodes_03_11_25 WHERE id = $1
         )
         GROUP BY (gn.community % 10)
         ORDER BY count DESC`,
        [targetTwitterId]
      )

      const totalFollowersInGraph = result.rows.reduce((sum: number, row: any) => sum + parseInt(row.count), 0)
      
      const communities = result.rows.map((row: any) => ({
        community: parseInt(row.community),
        count: parseInt(row.count),
        percentage: totalFollowersInGraph > 0 
          ? parseFloat(((parseInt(row.count) / totalFollowersInGraph) * 100).toFixed(1))
          : 0
      }))

      console.log("📊 [getFollowerCommunityStatsForTarget] Found", communities.length, "communities for", totalFollowersInGraph, "followers of target", targetTwitterId)
      return { data: { communities, totalFollowersInGraph }, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowerCommunityStatsForTarget',
        errorString,
        'system',
        { targetTwitterId }
      )
      return { data: null, error }
    }
  },

  /**
   * Récupère les sources (followings) pour un follower non-onboardé
   * Utilise la RPC get_followed_sources_for_follower qui fait le join
   * sources_followers -> next-auth.users -> graph_nodes
   * 
   * @param followerTwitterId - twitter_id du follower
   * @returns Liste des sources avec coord_hash, x, y, source_twitter_id, source_twitter_username
   */
  async getFollowedSourcesForFollower(
    followerTwitterId: string
  ): Promise<{ 
    data: { 
      coord_hash: string; 
      x: number; 
      y: number; 
      source_twitter_id: string; 
      source_twitter_username: string | null;
    }[] | null; 
    error: any 
  }> {
    try {
      const result = await queryPublic(
        `SELECT 
           coord_hash,
           x,
           y,
           source_twitter_id::text,
           source_twitter_username
         FROM public.get_followed_sources_for_follower($1::bigint)`,
        [followerTwitterId]
      )

      const data = result.rows.map((row: any) => ({
        coord_hash: row.coord_hash,
        x: parseFloat(row.x),
        y: parseFloat(row.y),
        source_twitter_id: row.source_twitter_id,
        source_twitter_username: row.source_twitter_username,
      }))

      console.log("📊 [getFollowedSourcesForFollower] Found", data.length, "sources for follower", followerTwitterId)
      return { data, error: null }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgMatchingRepository.getFollowedSourcesForFollower',
        errorString,
        'system',
        { followerTwitterId }
      )
      return { data: null, error }
    }
  },
}
