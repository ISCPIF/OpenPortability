/**
 * Types for tile-based progressive graph loading
 * Similar to Google Maps tile system
 */

import { GraphNode, BoundingBox, GraphTier, GraphNodeType } from '@/lib/types/graph';

// ============================================
// Tile System Types
// ============================================

/** Tile key format: "z{level}_x{tileX}_y{tileY}" */
export type TileKey = string;

/** Tile zoom level (0 = zoomed out, higher = zoomed in) */
export type TileZoomLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Configuration for the tile system */
export interface TileSystemConfig {
  /** Minimum scale (zoomed out) - shows only base nodes */
  MIN_SCALE: number;
  /** Maximum scale (zoomed in) - shows all detail tiles */
  MAX_SCALE: number;
  /** Number of zoom levels (0 to LEVELS-1) */
  LEVELS: number;
  /** Coordinate range: coordinates go from -COORD_RANGE/2 to +COORD_RANGE/2 */
  COORD_RANGE: number;
  /** Base nodes count (always displayed) */
  BASE_NODES_COUNT: number;
  /** Max nodes per tile fetch */
  NODES_PER_TILE: number;
  /** Max total nodes in memory */
  MAX_MEMORY_NODES: number;
  /** Debounce delay in ms */
  DEBOUNCE_MS: number;
}

/** Default tile system configuration */
export const DEFAULT_TILE_SYSTEM_CONFIG: TileSystemConfig = {
  MIN_SCALE: 0.05,        // Below this: only base nodes
  MAX_SCALE: 2.0,         // Max zoom level
  LEVELS: 5,              // Zoom levels 0-4
  COORD_RANGE: 200,       // Coordinates in [-100, 100]
  BASE_NODES_COUNT: 100_000,
  NODES_PER_TILE: 10_000,
  MAX_MEMORY_NODES: 600_000,
  DEBOUNCE_MS: 250,
};

/** A single tile with its nodes */
export interface Tile {
  key: TileKey;
  zoomLevel: TileZoomLevel;
  bounds: BoundingBox;
  nodes: GraphNode[];
  timestamp: number;
}

/** Cached tile in IndexedDB */
export interface CachedTile {
  key: TileKey;
  zoomLevel: number;
  bounds: BoundingBox;
  nodes: CachedTileNode[];
  timestamp: number;
}

/** Minimal node representation for cache storage */
export interface CachedTileNode {
  id: string;
  label: string;
  x: number;
  y: number;
  degree: number;
  community: number | null;
  tier: GraphTier;
  nodeType?: GraphNodeType;
}

/** Tile cache state */
export interface TileCacheState {
  /** All tiles loaded in memory, keyed by TileKey */
  tiles: Map<TileKey, GraphNode[]>;
  /** Set of tile keys that are currently displayed */
  displayedTileKeys: Set<TileKey>;
  /** Current zoom level */
  currentZoomLevel: TileZoomLevel;
  /** Loading state */
  isLoading: boolean;
}

// ============================================
// Conversion helpers
// ============================================

export function graphNodeToCachedTileNode(node: GraphNode): CachedTileNode {
  return {
    id: node.id,
    label: node.label,
    x: node.x,
    y: node.y,
    degree: node.degree,
    community: node.community,
    tier: node.tier,
    nodeType: node.nodeType,
  };
}

export function cachedTileNodeToGraphNode(cached: CachedTileNode): GraphNode {
  return {
    id: cached.id,
    label: cached.label,
    x: cached.x,
    y: cached.y,
    size: 1, // Default size
    color: '#888888', // Default color
    degree: cached.degree,
    community: cached.community,
    tier: cached.tier,
    nodeType: cached.nodeType,
  };
}
