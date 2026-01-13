/**
 * Service pour les opérations sur les nœuds du graphe
 * Combine les données de graph_nodes avec les mappings Redis pour le matching
 */

import { pgGraphNodesRepository, GraphNodeRow } from '../repositories/public/pg-graph-nodes-repository'
import { redisMatchingRepository } from '../repositories/redis-matching-repository'
import logger from '../log_utils'

export interface LassoNodeMatch {
  twitter_id: string
  hash: string // coordHash(x, y)
  label: string | null
  x: number
  y: number
  community: number | null
  tier: string | null
  graph_label: string | null
  node_type: string | null
  // Matching info from Redis
  bluesky_handle: string | null
  mastodon_handle: string | null
  mastodon_username: string | null
  mastodon_instance: string | null
  // Follow status (to be enriched by caller if needed)
  has_follow_bluesky: boolean
  has_follow_mastodon: boolean
}

// Helper to create a hash from coordinates (same as frontend)
function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`
}

// Helper to clean mastodon instance (remove https://, trailing TLDs like .fr, .com, .social, etc.)
function cleanMastodonInstance(instance: string): string {
  if (!instance) return instance
  
  // Remove protocol
  let cleaned = instance.replace(/^https?:\/\//, '')
  
  // Remove trailing slash
  cleaned = cleaned.replace(/\/$/, '')
  
  // Remove common TLDs at the end (but keep the domain name)
  // e.g., "mastodon.social" stays as "mastodon.social", but we just clean the protocol
  // If you want to remove the TLD entirely: cleaned = cleaned.replace(/\.(com|fr|social|online|xyz|org|net|io)$/, '')
  
  return cleaned
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

export class GraphNodesService {
  /**
   * Récupère les nœuds du graphe par leurs hashes de coordonnées
   * et enrichit avec les informations de matching depuis Redis
   */
  async getNodesByHashes(hashes: string[]): Promise<LassoNodeMatch[]> {
    if (hashes.length === 0) return []

    logger.logDebug(
      'Service',
      'GraphNodesService.getNodesByHashes',
      `Processing ${hashes.length} hashes`,
      'system'
    )

    // 1. Récupérer les nœuds depuis PostgreSQL
    const nodes = await pgGraphNodesRepository.getNodesByHashes(hashes)

    if (nodes.length === 0) {
      logger.logWarning(
        'Service',
        'GraphNodesService.getNodesByHashes',
        'No nodes found for provided hashes',
        'system',
        { hashesCount: hashes.length }
      )
      return []
    }

    // 2. Récupérer les handles depuis Redis
    const twitterIds = nodes.map(n => n.id)
    const handlesMap = await redisMatchingRepository.getHandlesFromTwitterIds(twitterIds)

    // 3. Combiner les données et filtrer pour ne garder que ceux avec BS ou Mastodon
    const allNodes: LassoNodeMatch[] = nodes.map(node => {
      const handles = handlesMap.get(node.id)
      const cleanedInstance = handles?.mastodon?.instance 
        ? cleanMastodonInstance(handles.mastodon.instance) 
        : null
      
      return {
        twitter_id: node.id,
        hash: coordHash(node.x, node.y),
        label: node.label,
        x: node.x,
        y: node.y,
        community: node.community,
        tier: node.tier,
        graph_label: node.graph_label,
        node_type: node.node_type,
        bluesky_handle: handles?.bluesky?.username || null,
        mastodon_handle: handles?.mastodon 
          ? `@${handles.mastodon.username}@${cleanedInstance}`
          : null,
        mastodon_username: handles?.mastodon?.username || null,
        mastodon_instance: cleanedInstance,
        has_follow_bluesky: false, // To be enriched by caller
        has_follow_mastodon: false, // To be enriched by caller
      }
    })

    // Filtrer pour ne garder que les membres avec au moins un compte BS ou Mastodon
    const results = allNodes.filter(node => 
      node.node_type === 'member' && (node.bluesky_handle || node.mastodon_handle)
    )

    logger.logDebug(
      'Service',
      'GraphNodesService.getNodesByHashes',
      `Returning ${results.length} enriched nodes (filtered from ${allNodes.length})`,
      'system',
      {
        totalNodes: allNodes.length,
        withBluesky: results.filter(r => r.bluesky_handle).length,
        withMastodon: results.filter(r => r.mastodon_handle).length,
      }
    )

    return results
  }

  /**
   * Récupère les nœuds du graphe par leurs coordonnées
   * et enrichit avec les informations de matching depuis Redis
   */
  async getNodesByCoordinates(coordinates: { x: number; y: number }[]): Promise<LassoNodeMatch[]> {
    if (coordinates.length === 0) return []

    // Convert to hashes and use the hash-based method
    const hashes = coordinates.map(c => coordHash(c.x, c.y))
    return this.getNodesByHashes(hashes)
  }

  /**
   * Récupère les nœuds du graphe par leurs twitter_ids
   * et enrichit avec les informations de matching depuis Redis
   */
  async getNodesByTwitterIds(twitterIds: string[]): Promise<LassoNodeMatch[]> {
    if (twitterIds.length === 0) return []

    logger.logDebug(
      'Service',
      'GraphNodesService.getNodesByTwitterIds',
      `Processing ${twitterIds.length} twitter IDs`,
      'system'
    )

    // 1. Récupérer les nœuds depuis PostgreSQL
    const nodes = await pgGraphNodesRepository.getNodesByTwitterIds(twitterIds)

    if (nodes.length === 0) {
      return []
    }

    // 2. Récupérer les handles depuis Redis
    const handlesMap = await redisMatchingRepository.getHandlesFromTwitterIds(twitterIds)

    // 3. Combiner les données
    const results: LassoNodeMatch[] = nodes.map(node => {
      const handles = handlesMap.get(node.id)
      const cleanedInstance = handles?.mastodon?.instance 
        ? cleanMastodonInstance(handles.mastodon.instance) 
        : null
      
      return {
        twitter_id: node.id,
        hash: coordHash(node.x, node.y),
        label: node.label,
        x: node.x,
        y: node.y,
        community: node.community,
        tier: node.tier,
        graph_label: node.graph_label,
        node_type: node.node_type,
        bluesky_handle: handles?.bluesky?.username || null,
        mastodon_handle: handles?.mastodon 
          ? `@${handles.mastodon.username}@${cleanedInstance}`
          : null,
        mastodon_username: handles?.mastodon?.username || null,
        mastodon_instance: cleanedInstance,
        has_follow_bluesky: false,
        has_follow_mastodon: false,
      }
    })

    return results
  }

  /**
   * Récupère les nœuds membres du graphe par leurs hashes de coordonnées
   * ET qui sont aussi présents dans la table users_with_name_consent
   * Enrichit avec les informations de matching depuis Redis
   */
  async getMemberNodesByHashesWithConsent(hashes: string[]): Promise<LassoNodeMatch[]> {
    if (hashes.length === 0) return []

    logger.logDebug(
      'Service',
      'GraphNodesService.getMemberNodesByHashesWithConsent',
      `Processing ${hashes.length} hashes`,
      'system'
    )

    // 1. Récupérer les nœuds membres avec consentement depuis PostgreSQL
    const nodes = await pgGraphNodesRepository.getMemberNodesByHashesWithConsent(hashes)

    if (nodes.length === 0) {
      logger.logDebug(
        'Service',
        'GraphNodesService.getMemberNodesByHashesWithConsent',
        'No member nodes with consent found for provided hashes',
        'system',
        { hashesCount: hashes.length }
      )
      return []
    }

    // 2. Récupérer les handles depuis Redis
    const twitterIds = nodes.map(n => n.id)
    const handlesMap = await redisMatchingRepository.getHandlesFromTwitterIds(twitterIds)

    // 3. Combiner les données et filtrer pour ne garder que ceux avec BS ou Mastodon
    const results: LassoNodeMatch[] = nodes
      .map(node => {
        const handles = handlesMap.get(node.id)
        const cleanedInstance = handles?.mastodon?.instance 
          ? cleanMastodonInstance(handles.mastodon.instance) 
          : null
        
        return {
          twitter_id: node.id,
          hash: coordHash(node.x, node.y),
          label: node.label,
          x: node.x,
          y: node.y,
          community: node.community,
          tier: node.tier,
          graph_label: node.graph_label,
          node_type: node.node_type,
          bluesky_handle: handles?.bluesky?.username || null,
          mastodon_handle: handles?.mastodon 
            ? `@${handles.mastodon.username}@${cleanedInstance}`
            : null,
          mastodon_username: handles?.mastodon?.username || null,
          mastodon_instance: cleanedInstance,
          has_follow_bluesky: false,
          has_follow_mastodon: false,
        }
      })
      .filter(node => node.bluesky_handle || node.mastodon_handle)

    logger.logDebug(
      'Service',
      'GraphNodesService.getMemberNodesByHashesWithConsent',
      `Returning ${results.length} enriched member nodes with consent`,
      'system',
      {
        totalNodes: nodes.length,
        withBluesky: results.filter(r => r.bluesky_handle).length,
        withMastodon: results.filter(r => r.mastodon_handle).length,
      }
    )

    return results
  }
}

// Export singleton instance
export const graphNodesService = new GraphNodesService()
