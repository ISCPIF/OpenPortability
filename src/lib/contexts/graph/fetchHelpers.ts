/**
 * API fetch helpers for tile-based graph loading
 */

import { tableFromIPC, Table } from 'apache-arrow';
import { GraphNode, BoundingBox } from '@/lib/types/graph';
import { TileKey, TileSystemConfig, DEFAULT_TILE_SYSTEM_CONFIG } from './types';
import { getTileBounds } from './tileHelpers';

// ============================================
// Arrow Parsing
// ============================================

/**
 * Parse Arrow table to GraphNode array
 */
export function parseArrowToNodes(arrowTable: Table): GraphNode[] {
  const nodes: GraphNode[] = [];
  
  for (let i = 0; i < arrowTable.numRows; i++) {
    const row = arrowTable.get(i);
    if (!row) continue;
    
    const label = row.label?.toString() || '';
    const x = Number(row.x) || 0;
    const y = Number(row.y) || 0;
    const community = row.community != null ? Number(row.community) : null;
    const degree = Number(row.degree) || 0;
    const tier = (row.tier?.toString() || 'minor') as 'major' | 'medium' | 'minor';
    const nodeType = row.node_type?.toString() as 'generic' | 'member' | undefined;
    
    // Generate unique ID from coordinates (coord_hash)
    const id = `${x.toFixed(6)}_${y.toFixed(6)}`;
    
    nodes.push({
      id,
      label,
      x,
      y,
      size: 1,
      color: '#888888',
      community,
      degree,
      tier,
      nodeType,
    });
  }
  
  return nodes;
}

// ============================================
// Base Nodes Fetch
// ============================================

/**
 * Fetch base nodes (top N by degree)
 * Uses CTE with consent nodes pattern like GraphDataContext.tsx
 */
export async function fetchBaseNodes(
  count: number = DEFAULT_TILE_SYSTEM_CONFIG.BASE_NODES_COUNT,
  excludeCommunity: number = 8
): Promise<{ nodes: GraphNode[]; minDegree: number }> {
  const sql = `
    WITH consent_nodes AS (
      SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type, 
             pa.raw_description AS description, 0 as priority
      FROM postgres_db.public.graph_nodes_03_11_25 g
      INNER JOIN postgres_db.public.users_with_name_consent u ON g.id = u.twitter_id
      LEFT JOIN postgres_db.public.public_accounts pa
        ON pa.twitter_id = u.twitter_id AND u.is_public_account = true
      WHERE g.community != ${excludeCommunity}
    ),
    other_nodes AS (
      SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type,
             NULL AS description, 1 as priority
      FROM postgres_db.public.graph_nodes_03_11_25 g
      WHERE g.community != ${excludeCommunity}
        AND NOT EXISTS (
          SELECT 1 FROM postgres_db.public.users_with_name_consent u WHERE u.twitter_id = g.id
        )
    ),
    combined AS (
      SELECT * FROM consent_nodes
      UNION ALL
      SELECT * FROM other_nodes
    )
    SELECT label, x, y, community, degree, tier, node_type, description, priority
    FROM combined
    ORDER BY priority ASC, degree DESC
    LIMIT ${count}
  `;
  
  const response = await fetch('/api/mosaic/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, type: 'arrow' }),
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch base nodes: ${response.statusText}`);
  }
  
  const buffer = await response.arrayBuffer();
  const arrowTable = tableFromIPC(buffer);
  const nodes = parseArrowToNodes(arrowTable);
  
  // Calculate min degree for progressive loading threshold
  const minDegree = nodes.length > 0 
    ? Math.min(...nodes.map(n => n.degree))
    : 0;
  
  return { nodes, minDegree };
}

// ============================================
// Tile Fetch
// ============================================

/**
 * Fetch nodes for a specific tile
 */
export async function fetchTileNodes(
  tileKey: TileKey,
  maxDegree: number,
  nodesPerTile: number = DEFAULT_TILE_SYSTEM_CONFIG.NODES_PER_TILE,
  excludeCommunity: number = 8,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): Promise<GraphNode[]> {
  const bounds = getTileBounds(tileKey, config);
  if (!bounds) {
    console.warn(`⚠️ [FetchHelpers] Invalid tile key: ${tileKey}`);
    return [];
  }
  
  return fetchNodesInBbox(bounds, maxDegree, nodesPerTile, excludeCommunity);
}

/**
 * Fetch nodes within a bounding box
 * Uses same pattern as GraphDataContext.tsx fetchDetailNodes
 */
export async function fetchNodesInBbox(
  bbox: BoundingBox,
  maxDegree: number,
  limit: number,
  excludeCommunity: number = 8
): Promise<GraphNode[]> {
  const sql = `
    SELECT g.label, g.x, g.y, g.community, g.degree, g.tier, g.node_type
    FROM postgres_db.public.graph_nodes_03_11_25 g
    WHERE g.community != ${excludeCommunity}
      AND g.degree < ${maxDegree}
      AND g.x BETWEEN ${bbox.minX} AND ${bbox.maxX}
      AND g.y BETWEEN ${bbox.minY} AND ${bbox.maxY}
    ORDER BY g.degree DESC
    LIMIT ${limit}
  `;
  
  console.log(`📦 [FetchHelpers] Fetching ${limit} nodes with degree < ${maxDegree.toFixed(4)} in bbox [${bbox.minX.toFixed(2)},${bbox.maxX.toFixed(2)}]x[${bbox.minY.toFixed(2)},${bbox.maxY.toFixed(2)}]`);
  
  const response = await fetch('/api/mosaic/sql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql, type: 'arrow' }),
  });
  
  if (!response.ok) {
    console.warn(`⚠️ [FetchHelpers] Failed to fetch tile: ${response.statusText}`);
    return [];
  }
  
  const buffer = await response.arrayBuffer();
  const arrowTable = tableFromIPC(buffer);
  return parseArrowToNodes(arrowTable);
}

/**
 * Fetch multiple tiles in parallel
 */
export async function fetchMultipleTiles(
  tileKeys: TileKey[],
  maxDegree: number,
  nodesPerTile: number = DEFAULT_TILE_SYSTEM_CONFIG.NODES_PER_TILE,
  excludeCommunity: number = 8,
  config: TileSystemConfig = DEFAULT_TILE_SYSTEM_CONFIG
): Promise<Map<TileKey, GraphNode[]>> {
  const result = new Map<TileKey, GraphNode[]>();
  
  // Fetch tiles in parallel (max 4 concurrent)
  const batchSize = 4;
  for (let i = 0; i < tileKeys.length; i += batchSize) {
    const batch = tileKeys.slice(i, i + batchSize);
    const promises = batch.map(async (tileKey) => {
      const nodes = await fetchTileNodes(tileKey, maxDegree, nodesPerTile, excludeCommunity, config);
      return { tileKey, nodes };
    });
    
    const results = await Promise.all(promises);
    for (const { tileKey, nodes } of results) {
      result.set(tileKey, nodes);
    }
  }
  
  return result;
}

// ============================================
// Labels Fetch
// ============================================

/**
 * Fetch floating labels for the graph
 */
export async function fetchFloatingLabels(): Promise<Array<{
  coord_hash: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}>> {
  try {
    const response = await fetch('/api/graph/refresh-labels-cache', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      console.warn('⚠️ [FetchHelpers] Failed to fetch labels');
      return [];
    }
    
    const data = await response.json();
    const labels = data.labels || [];
    
    // Ensure each label has a coord_hash
    return labels.map((label: { x: number; y: number; text: string; priority: number; level: number; coord_hash?: string }) => ({
      ...label,
      coord_hash: label.coord_hash || `${label.x.toFixed(6)}_${label.y.toFixed(6)}`,
    }));
  } catch (error) {
    console.error('❌ [FetchHelpers] Error fetching labels:', error);
    return [];
  }
}
