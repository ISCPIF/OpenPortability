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