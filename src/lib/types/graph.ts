export type GraphNodeType = 'generic' | 'member';

export interface GraphNode {
  id: string;                    // twitter_id
  label: string;                 // @username enrichi
  x: number;                     // position X depuis Gephi
  y: number;                     // position Y depuis Gephi
  size: number;                  // taille normalisée (influence)
  color: string;                 // couleur hex de la communauté
  community: number | null;      // ID de la communauté
  degree: number;                // nombre de connexions
  tier: GraphTier;               // niveau d'importance
  nodeType?: GraphNodeType;      // type de nœud (generic ou member) - camelCase from API
  graphLabel?: string | null;    // label personnalisé (ex: twitter_username pour members) - camelCase from API
  description?: string | null;   // description from graph_personal_labels (for tooltip on hover)
  created_at?: string;
  updated_at?: string;
  metadata?: PersonalNetworkMetadata; // Optional metadata for personal network overlay
}

export interface PersonalNetworkMetadata {
  isPersonalNetwork: boolean;
  isUserNode?: boolean;
  hasBlueskyFollow?: boolean;
  hasMastodonFollow?: boolean;
  blueskyHandle?: string | null;
  mastodonHandle?: string | null;
}

export type GraphTier = 'major' | 'medium' | 'minor';

export interface GraphOverview {
  nodes: GraphNode[];
  metadata: GraphMetadata;
}

export interface GraphMetadata {
  totalNodes: number;
  majorNodes: number;
  mediumNodes: number;
  minorNodes: number;
  communities: number;
  boundingBox: BoundingBox;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface GraphFilters {
  tier?: GraphTier | GraphTier[];
  community?: number | number[];
  minDegree?: number;
  maxDegree?: number;
  boundingBox?: BoundingBox;
  limit?: number;
  offset?: number;
}

export interface GraphUserView {
  nodes: GraphNodeWithRelation[];
  metadata: GraphMetadata;
}

export interface GraphNodeWithRelation extends GraphNode {
  relationStatus: RelationStatus;
  followsBluesky?: boolean;
  followsMastodon?: boolean;
  followedBluesky?: boolean;
  followedMastodon?: boolean;
}

export type RelationStatus = 'mutual' | 'i_follow' | 'follows_me' | 'no_relation';

// Pour les requêtes de zoom/pan
export interface GraphViewport {
  centerX: number;
  centerY: number;
  zoom: number;
  width: number;
  height: number;
}

// Requête de viewport avec zoom adaptatif
export interface ViewportRequest {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zoomLevel: number;
  maxNodes?: number;
  community?: number;
}

// Réponse API standardisée
export interface GraphApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: GraphMetadata;
  error?: string;
}

// Configuration du cache
export interface GraphCacheConfig {
  overviewTTL: number;        // TTL pour la vue d'ensemble
  userViewTTL: number;        // TTL pour les vues utilisateur
  metadataTTL: number;        // TTL pour les métadonnées
}

// ============================================
// Tile-based progressive loading types
// ============================================

// Configuration for tile-based loading
export interface TileConfig {
  INITIAL_NODES: number;        // Nodes loaded at startup (top degree)
  ZOOM_THRESHOLD: number;       // Zoom level to trigger tile loading
  NODES_PER_TILE: number;       // Max nodes per tile request
  MAX_MEMORY_NODES: number;     // Total memory limit for nodes
  DEBOUNCE_MS: number;          // Debounce delay before fetch
  TILE_CACHE_SIZE: number;      // Number of tiles in LRU cache
}

// Default tile configuration
// NOTE: In embedding-atlas, scale works as follows:
//   - scale = 0.02-0.03 = zoomed OUT (see whole graph)
//   - scale = 0.1-5+ = zoomed IN (see details)
// So we load tiles when scale > ZOOM_THRESHOLD (user is zooming in)
export const DEFAULT_TILE_CONFIG: TileConfig = {
  INITIAL_NODES: 100_000,
  ZOOM_THRESHOLD: 0.05,         // Load tiles when scale > 0.05 (zooming in from initial ~0.025)
  NODES_PER_TILE: 50_000,
  MAX_MEMORY_NODES: 600_000,    // Allow up to 400k nodes (100k initial + 6x50k progressive)
  DEBOUNCE_MS: 250,             // 250ms debounce to avoid too frequent loads
  TILE_CACHE_SIZE: 20,
};

// Auth tile configuration (higher limits for authenticated users)
// Includes personal network prioritization (followings + effectiveFollowers + userNode)
export const AUTH_TILE_CONFIG: TileConfig = {
  INITIAL_NODES: 150_000,       // 150k for auth users (consent + network + top degree)
  ZOOM_THRESHOLD: 0.05,
  NODES_PER_TILE: 50_000,
  MAX_MEMORY_NODES: 700_000,    // Allow up to 700k nodes (150k initial + progressive)
  DEBOUNCE_MS: 250,
  TILE_CACHE_SIZE: 20,
};

// Viewport state for tracking zoom/pan
export interface ViewportState {
  boundingBox: BoundingBox;
  zoom: number;
  timestamp: number;
}

// Tile request for DuckDB API
export interface TileRequest {
  boundingBox: BoundingBox;
  zoomLevel: number;
  limit: number;
  excludeCommunity?: number;  // e.g., exclude community 8
}

// Cached tile entry
export interface TileCacheEntry {
  key: string;
  nodes: GraphNode[];
  timestamp: number;
  boundingBox: BoundingBox;
}