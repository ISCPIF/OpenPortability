/**
 * Repository PostgreSQL pour les opérations sur graph_nodes
 * Gère la récupération des nœuds du graphe depuis la table graph_nodes_03_11_25
 */

import { queryPublic } from '../../database'
import logger from '../../log_utils'

// Nom de la table graph_nodes (peut être mis à jour si la table change)
const GRAPH_NODES_TABLE = 'graph_nodes_03_11_25'

export interface GraphNodeRow {
  id: string // twitter_id (bigint as string)
  label: string | null
  x: number
  y: number
  size: number | null
  color: string | null
  community: number | null
  degree: number
  tier: string | null
  graph_label: string | null
  node_type: string | null
  created_at: Date | null
  updated_at: Date | null
}

export interface GraphNodeMatch {
  twitter_id: string
  label: string | null
  x: number
  y: number
  community: number | null
  tier: string | null
  graph_label: string | null
  node_type: string | null
  // Matching info (to be enriched by matching service)
  bluesky_handle?: string | null
  mastodon_handle?: string | null
  has_follow_bluesky?: boolean
  has_follow_mastodon?: boolean
}

// Helper to create a hash from coordinates (same as frontend)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`
}

// Parse hash back to coordinates
function parseCoordHash(hash: string): { x: number; y: number } | null {
  const parts = hash.split('_')
  if (parts.length !== 2) return null
  const x = parseFloat(parts[0])
  const y = parseFloat(parts[1])
  if (isNaN(x) || isNaN(y)) return null
  return { x, y }
}

export const pgGraphNodesRepository = {
  /**
   * Récupère les nœuds du graphe par leurs coordonnées (hash)
   * Utilise une tolérance pour la comparaison des coordonnées flottantes
   */
  async getNodesByCoordinates(coordinates: { x: number; y: number }[]): Promise<GraphNodeRow[]> {
    if (coordinates.length === 0) return []

    try {
      // Build a query that matches coordinates with a small tolerance
      // Using 6 decimal places precision (same as coordHash)
      const tolerance = 0.0000005 // Half of the precision

      const conditions: string[] = []
      const values: any[] = []

      coordinates.forEach((coord, index) => {
        const xParam = index * 2 + 1
        const yParam = index * 2 + 2
        conditions.push(`(ABS(x - $${xParam}) < ${tolerance} AND ABS(y - $${yParam}) < ${tolerance})`)
        values.push(coord.x, coord.y)
      })

      const query = `
        SELECT id::text as id, label, x, y, size, color, community, degree, tier, graph_label, node_type, created_at, updated_at
        FROM ${GRAPH_NODES_TABLE}
        WHERE ${conditions.join(' OR ')}
      `

      const result = await queryPublic(query, values)

      logger.logDebug(
        'Repository',
        'pgGraphNodesRepository.getNodesByCoordinates',
        `Found ${result.rows.length} nodes for ${coordinates.length} coordinates`,
        'system'
      )

      return result.rows as GraphNodeRow[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getNodesByCoordinates',
        errorString,
        'system',
        { coordinatesCount: coordinates.length }
      )
      throw error
    }
  },

  /**
   * Récupère les nœuds du graphe par leurs hashes de coordonnées
   */
  async getNodesByHashes(hashes: string[]): Promise<GraphNodeRow[]> {
    if (hashes.length === 0) return []

    // Parse hashes to coordinates
    const coordinates: { x: number; y: number }[] = []
    for (const hash of hashes) {
      const coord = parseCoordHash(hash)
      if (coord) {
        coordinates.push(coord)
      }
    }

    if (coordinates.length === 0) {
      logger.logWarning(
        'Repository',
        'pgGraphNodesRepository.getNodesByHashes',
        'No valid coordinates parsed from hashes',
        'system',
        { hashesCount: hashes.length }
      )
      return []
    }

    return this.getNodesByCoordinates(coordinates)
  },

  /**
   * Récupère un nœud par son twitter_id
   */
  async getNodeByTwitterId(twitterId: string): Promise<GraphNodeRow | null> {
    try {
      const result = await queryPublic(
        `SELECT id::text as id, label, x, y, size, color, community, degree, tier, graph_label, node_type, created_at, updated_at
         FROM ${GRAPH_NODES_TABLE}
         WHERE id = $1`,
        [twitterId]
      )

      if (result.rows.length === 0) {
        return null
      }

      return result.rows[0] as GraphNodeRow
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getNodeByTwitterId',
        errorString,
        'system',
        { twitterId }
      )
      throw error
    }
  },

  /**
   * Récupère plusieurs nœuds par leurs twitter_ids
   */
  async getNodesByTwitterIds(twitterIds: string[]): Promise<GraphNodeRow[]> {
    if (twitterIds.length === 0) return []

    try {
      // Build parameterized query
      const placeholders = twitterIds.map((_, i) => `$${i + 1}`).join(', ')
      
      const result = await queryPublic(
        `SELECT id::text as id, label, x, y, size, color, community, degree, tier, graph_label, node_type, created_at, updated_at
         FROM ${GRAPH_NODES_TABLE}
         WHERE id IN (${placeholders})`,
        twitterIds
      )

      return result.rows as GraphNodeRow[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getNodesByTwitterIds',
        errorString,
        'system',
        { twitterIdsCount: twitterIds.length }
      )
      throw error
    }
  },

  /**
   * Récupère les hashes (coordonnées) des nœuds par leurs twitter_ids
   * Retourne uniquement les hashes, pas les twitter_ids (RGPD-friendly)
   */
  async getHashesByTwitterIds(twitterIds: string[]): Promise<{ hash: string; hasBluesky?: boolean; hasMastodon?: boolean }[]> {
    if (twitterIds.length === 0) return []

    try {
      // Build parameterized query
      const placeholders = twitterIds.map((_, i) => `$${i + 1}`).join(', ')
      
      const result = await queryPublic(
        `SELECT x, y
         FROM ${GRAPH_NODES_TABLE}
         WHERE id IN (${placeholders})`,
        twitterIds
      )

      // Convert coordinates to hashes
      return result.rows.map((row: { x: number; y: number }) => ({
        hash: coordHash(row.x, row.y),
      }))
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getHashesByTwitterIds',
        errorString,
        'system',
        { twitterIdsCount: twitterIds.length }
      )
      throw error
    }
  },

  /**
   * Récupère les personal labels avec leurs coordonnées pour le graphe
   * Jointure entre graph_personal_labels et graph_nodes
   */
  async getPersonalLabelsWithCoords(): Promise<{
    display_label: string
    x: number
    y: number
    degree: number
  }[]> {
    try {
      const result = await queryPublic(
        `SELECT 
          pl.display_label,
          gn.x,
          gn.y,
          gn.degree
        FROM graph_personal_labels pl
        INNER JOIN ${GRAPH_NODES_TABLE} gn ON gn.id = pl.twitter_id`
      )

      return result.rows as {
        display_label: string
        x: number
        y: number
        degree: number
      }[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getPersonalLabelsWithCoords',
        errorString,
        'system'
      )
      throw error
    }
  },

  /**
   * Récupère les nœuds de type 'member' uniquement
   */
  async getMemberNodes(limit: number = 1000): Promise<GraphNodeRow[]> {
    try {
      const result = await queryPublic(
        `SELECT id::text as id, label, x, y, size, color, community, degree, tier, graph_label, node_type, created_at, updated_at
         FROM ${GRAPH_NODES_TABLE}
         WHERE node_type = 'member'
         ORDER BY degree DESC
         LIMIT $1`,
        [limit]
      )

      return result.rows as GraphNodeRow[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getMemberNodes',
        errorString,
        'system',
        { limit }
      )
      throw error
    }
  },

  /**
   * Récupère les labels visibles pour un utilisateur selon les consentements
   * Simplifié: retourne tous les labels avec all_consent
   * (la fonctionnalité followers_of_followers a été abandonnée)
   * 
   * @param userId - UUID de l'utilisateur connecté (non utilisé pour l'instant)
   * @param twitterId - Twitter ID de l'utilisateur (non utilisé pour l'instant)
   * @returns Labels visibles avec coordonnées
   */
  async getVisibleLabelsForUser(
    userId: string,
    twitterId?: string | null
  ): Promise<{
    node_id: string
    display_label: string
    consent_level: string
    visibility_reason: string
    x: number
    y: number
    follower_level: number
  }[]> {
    try {
      // Simplifié: retourne tous les all_consent labels
      // On garde les mêmes champs pour compatibilité avec l'API
      console.log(`[getVisibleLabelsForUser] Fetching all_consent labels for user ${userId}`)
      
      // // Debug: check how many users have all_consent
      // const countResult = await queryPublic(
      //   `SELECT COUNT(*) as total FROM users_with_name_consent WHERE consent_level = 'all_consent'`
      // )
      // console.log(`[getVisibleLabelsForUser] Total users with all_consent: ${countResult.rows[0]?.total}`)
      
      // // Debug: check if their twitter_ids exist in graph_nodes
      // const missingResult = await queryPublic(
      //   `SELECT uwnc.twitter_id, uwnc.name 
      //    FROM users_with_name_consent uwnc 
      //    LEFT JOIN ${GRAPH_NODES_TABLE} gn ON gn.id = uwnc.twitter_id 
      //    WHERE uwnc.consent_level = 'all_consent' AND gn.id IS NULL`
      // )
      // if (missingResult.rows.length > 0) {
      //   console.log(`[getVisibleLabelsForUser] Users with all_consent but NOT in graph_nodes:`, JSON.stringify(missingResult.rows))
      // }
      
      const result = await queryPublic(
        `SELECT 
          uwnc.twitter_id::text as node_id,
          COALESCE(
            uwnc.name,
            '@' || uwnc.twitter_username,
            '@' || uwnc.bluesky_username,
            '@' || uwnc.mastodon_username,
            'User ' || uwnc.twitter_id
          ) as display_label,
          uwnc.consent_level,
          'all_consent' as visibility_reason,
          gn.x,
          gn.y,
          1 as follower_level
        FROM users_with_name_consent uwnc
        INNER JOIN ${GRAPH_NODES_TABLE} gn ON gn.id = uwnc.twitter_id
        WHERE uwnc.consent_level = 'all_consent'`
      )

      console.log(`[getVisibleLabelsForUser] Found ${result.rows.length} labels`)
      if (result.rows.length > 0) {
        console.log(`[getVisibleLabelsForUser] First label:`, JSON.stringify(result.rows[0]))
      }

      return result.rows as {
        node_id: string
        display_label: string
        consent_level: string
        visibility_reason: string
        x: number
        y: number
        follower_level: number
      }[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      console.error(`[getVisibleLabelsForUser] Error:`, errorString)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getVisibleLabelsForUser',
        errorString,
        'system',
        { userId, twitterId }
      )
      throw error
    }
  },

  /**
   * Récupère uniquement les labels avec consentement "all_consent" (visibles de tous)
   * Pour les utilisateurs non authentifiés
   * Utilise la fonction RPC avec un UUID null pour obtenir uniquement les all_consent
   */
  async getPublicConsentLabels(): Promise<{
    node_id: string
    display_label: string
    x: number
    y: number
  }[]> {
    try {
      // First, log how many users have all_consent
      const countResult = await queryPublic(
        `SELECT COUNT(*) as cnt FROM users_with_name_consent WHERE consent_level = 'all_consent'`
      )
      console.log(`[getPublicConsentLabels] Found ${countResult.rows[0]?.cnt || 0} users with all_consent`)

      // Pour les utilisateurs non authentifiés, on récupère uniquement les labels all_consent
      // depuis users_with_name_consent avec les coordonnées depuis graph_nodes
      const result = await queryPublic(
        `SELECT 
          uwnc.twitter_id::text as node_id,
          COALESCE(
            uwnc.name,
            '@' || uwnc.twitter_username,
            '@' || uwnc.bluesky_username,
            '@' || uwnc.mastodon_username,
            'User ' || uwnc.twitter_id
          ) as display_label,
          gn.x,
          gn.y
        FROM users_with_name_consent uwnc
        INNER JOIN ${GRAPH_NODES_TABLE} gn ON gn.id = uwnc.twitter_id
        WHERE uwnc.consent_level = 'all_consent'`
      )

      console.log(`[getPublicConsentLabels] After JOIN with graph_nodes: ${result.rows.length} labels found`)

      return result.rows as {
        node_id: string
        display_label: string
        x: number
        y: number
      }[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getPublicConsentLabels',
        errorString,
        'system'
      )
      throw error
    }
  },

  /**
   * Met à jour ou crée le consentement de label pour un utilisateur
   * Gère la table consent_names et users_with_name_consent
   * 
   * @param userId - UUID de l'utilisateur
   * @param consentValue - 'no_consent' | 'only_to_followers_of_followers' | 'all_consent'
   * @param metadata - IP et user agent pour audit
   */
  async updateNameConsent(
    userId: string,
    consentValue: 'no_consent' | 'only_to_followers_of_followers' | 'all_consent',
    metadata?: {
      ip_address?: string
      user_agent?: string
    }
  ): Promise<{ success: boolean; consent_level: string }> {
    try {
      // Process IP addresses
      let firstIpAddress: string | null = null
      let fullIpAddressChain: string | null = null

      if (metadata?.ip_address) {
        fullIpAddressChain = metadata.ip_address
        const ips = metadata.ip_address.split(',').map((ip) => ip.trim()).filter(Boolean)
        if (ips.length > 0) {
          firstIpAddress = ips[0]
        }
      }

      // Upsert atomique : insert ou update si un consentement actif existe déjà
      const insertResult = await queryPublic<{ id: string }>(
        `INSERT INTO consent_names(
          user_id, consent_value, ip_address, user_agent, ip_address_full, is_active, consent_timestamp, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) WHERE is_active = true
        DO UPDATE SET
          consent_value = EXCLUDED.consent_value,
          ip_address = EXCLUDED.ip_address,
          user_agent = EXCLUDED.user_agent,
          ip_address_full = EXCLUDED.ip_address_full,
          consent_timestamp = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id`,
        [userId, consentValue, firstIpAddress, metadata?.user_agent || null, fullIpAddressChain]
      )

      // Note: Le trigger handle_name_consent_update sur consent_names
      // gère automatiquement la mise à jour de users_with_name_consent
      // (INSERT/UPDATE si consent != no_consent, DELETE sinon)
      // Cache invalidation is handled by the client calling /api/graph/refresh-labels-cache

      logger.logInfo(
        'Repository',
        'pgGraphNodesRepository.updateNameConsent',
        `Updated name consent to ${consentValue}`,
        userId
      )

      return { success: true, consent_level: consentValue }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.updateNameConsent',
        errorString,
        userId,
        { consentValue }
      )
      throw error
    }
  },

  /**
   * Récupère les nœuds membres du graphe par leurs hashes de coordonnées
   * ET qui sont aussi présents dans la table users_with_name_consent (via twitter_id)
   * Cela permet de ne retourner que les membres qui ont donné leur consentement
   */
  async getMemberNodesByHashesWithConsent(hashes: string[]): Promise<GraphNodeRow[]> {
    if (hashes.length === 0) return []

    // Parse hashes to coordinates
    const coordinates: { x: number; y: number }[] = []
    for (const hash of hashes) {
      const coord = parseCoordHash(hash)
      if (coord) {
        coordinates.push(coord)
      }
    }

    if (coordinates.length === 0) {
      logger.logWarning(
        'Repository',
        'pgGraphNodesRepository.getMemberNodesByHashesWithConsent',
        'No valid coordinates parsed from hashes',
        'system',
        { hashesCount: hashes.length }
      )
      return []
    }

    try {
      const tolerance = 0.0000005

      const conditions: string[] = []
      const values: any[] = []

      coordinates.forEach((coord, index) => {
        const xParam = index * 2 + 1
        const yParam = index * 2 + 2
        conditions.push(`(ABS(g.x - $${xParam}) < ${tolerance} AND ABS(g.y - $${yParam}) < ${tolerance})`)
        values.push(coord.x, coord.y)
      })

      // Join with users_with_name_consent to filter only members with consent
      const query = `
        SELECT g.id::text as id, g.label, g.x, g.y, g.size, g.color, g.community, g.degree, g.tier, g.graph_label, g.node_type, g.created_at, g.updated_at
        FROM ${GRAPH_NODES_TABLE} g
        INNER JOIN users_with_name_consent u ON g.id = u.twitter_id
        WHERE g.node_type = 'member'
          AND (${conditions.join(' OR ')})
      `

      const result = await queryPublic(query, values)

      logger.logDebug(
        'Repository',
        'pgGraphNodesRepository.getMemberNodesByHashesWithConsent',
        `Found ${result.rows.length} member nodes with consent for ${coordinates.length} coordinates`,
        'system'
      )

      return result.rows as GraphNodeRow[]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getMemberNodesByHashesWithConsent',
        errorString,
        'system',
        { hashesCount: hashes.length }
      )
      throw error
    }
  },

  /**
   * Récupère le consentement de label actuel d'un utilisateur
   */
  async getNameConsent(userId: string): Promise<string | null> {
    try {
      const result = await queryPublic<{ consent_value: string }>(
        `SELECT consent_value FROM consent_names WHERE user_id = $1 AND is_active = true`,
        [userId]
      )
      return result.rows[0]?.consent_value || null
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getNameConsent',
        errorString,
        userId
      )
      throw error
    }
  },

  /**
   * Recherche un utilisateur par son display_label dans graph_personal_labels
   * Retourne les coordonnées (hash) et la description si trouvé
   */
  async searchByDisplayLabel(searchQuery: string): Promise<{
    twitter_id: string
    display_label: string
    description: string | null
    x: number
    y: number
    community: number | null
  } | null> {
    try {
      const result = await queryPublic<{
        twitter_id: string
        display_label: string
        description: string | null
        x: number
        y: number
        community: number | null
      }>(
        `WITH labeled AS (
          SELECT
            uwnc.twitter_id::text as twitter_id,
            COALESCE(
              uwnc.name,
              '@' || uwnc.twitter_username,
              '@' || uwnc.bluesky_username,
              '@' || uwnc.mastodon_username,
              'User ' || uwnc.twitter_id
            ) as display_label,
            CONCAT_WS(' ',
              uwnc.name,
              uwnc.twitter_username,
              uwnc.bluesky_username,
              uwnc.mastodon_username,
              pa.name,
              pa.twitter_username,
              pa.bluesky_username,
              pa.mastodon_username
            ) as searchable_text,
            CASE
              WHEN uwnc.is_public_account = true THEN pa.raw_description
              ELSE NULL
            END as description,
            gn.x,
            gn.y,
            gn.community
          FROM users_with_name_consent uwnc
          LEFT JOIN public_accounts pa
            ON pa.twitter_id = uwnc.twitter_id
            AND uwnc.is_public_account = true
          INNER JOIN ${GRAPH_NODES_TABLE} gn ON gn.id = uwnc.twitter_id
          WHERE uwnc.consent_level = 'all_consent'
        )
        SELECT twitter_id, display_label, description, x, y, community
        FROM labeled
        WHERE searchable_text ILIKE $1
        ORDER BY
          CASE WHEN LOWER(display_label) = LOWER($2) THEN 0 ELSE 1 END,
          display_label
        LIMIT 1`,
        [`%${searchQuery}%`, searchQuery]
      )

      if (result.rows.length === 0) {
        return null
      }

      logger.logDebug(
        'Repository',
        'pgGraphNodesRepository.searchByDisplayLabel',
        `Found user: ${result.rows[0].display_label}`,
        'system'
      )

      return result.rows[0]
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.searchByDisplayLabel',
        errorString,
        'system',
        { searchQuery }
      )
      throw error
    }
  },

  /**
   * Recherche plusieurs utilisateurs par display_label (autocomplete)
   */
  async searchByDisplayLabelMultiple(searchQuery: string, limit: number = 10): Promise<{
    twitter_id: string
    display_label: string
    description: string | null
    x: number
    y: number
    community: number | null
  }[]> {
    try {
      const result = await queryPublic<{
        twitter_id: string
        display_label: string
        description: string | null
        x: number
        y: number
        community: number | null
      }>(
        `WITH labeled AS (
          SELECT
            uwnc.twitter_id::text as twitter_id,
            COALESCE(
              uwnc.name,
              '@' || uwnc.twitter_username,
              '@' || uwnc.bluesky_username,
              '@' || uwnc.mastodon_username,
              'User ' || uwnc.twitter_id
            ) as display_label,
            CONCAT_WS(' ',
              uwnc.name,
              uwnc.twitter_username,
              uwnc.bluesky_username,
              uwnc.mastodon_username,
              pa.name,
              pa.twitter_username,
              pa.bluesky_username,
              pa.mastodon_username
            ) as searchable_text,
            CASE
              WHEN uwnc.is_public_account = true THEN pa.raw_description
              ELSE NULL
            END as description,
            gn.x,
            gn.y,
            gn.community
          FROM users_with_name_consent uwnc
          LEFT JOIN public_accounts pa
            ON pa.twitter_id = uwnc.twitter_id
            AND uwnc.is_public_account = true
          INNER JOIN ${GRAPH_NODES_TABLE} gn ON gn.id = uwnc.twitter_id
          WHERE uwnc.consent_level = 'all_consent'
        )
        SELECT twitter_id, display_label, description, x, y, community
        FROM labeled
        WHERE searchable_text ILIKE $1
        ORDER BY
          CASE WHEN LOWER(display_label) = LOWER($2) THEN 0 ELSE 1 END,
          LENGTH(display_label),
          display_label
        LIMIT $3`,
        [`%${searchQuery}%`, searchQuery, limit]
      )

      console.log(
        `!!!!! Found ${result.rows.length} users matching "${searchQuery}"`
      )

      return result.rows
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.searchByDisplayLabelMultiple',
        errorString,
        'system',
        { searchQuery, limit }
      )
      throw error
    }
  },

  /**
   * Get a node's coord_hash by twitter_id
   * Used to broadcast node_type changes to other clients
   */
  async getNodeCoordHashByTwitterId(twitterId: string): Promise<{ coord_hash: string; node_type: string; x: number; y: number } | null> {
    try {
      const result = await queryPublic<{ x: number; y: number; node_type: string }>(
        `SELECT x, y, node_type FROM ${GRAPH_NODES_TABLE} WHERE id = $1`,
        [twitterId]
      )

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return {
        coord_hash: coordHash(row.x, row.y),
        node_type: row.node_type || 'generic',
        x: row.x,
        y: row.y,
      }
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error)
      logger.logError(
        'Repository',
        'pgGraphNodesRepository.getNodeCoordHashByTwitterId',
        errorString,
        'system',
        { twitterId }
      )
      throw error
    }
  },

}
