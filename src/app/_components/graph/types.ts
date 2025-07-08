export interface GraphNode {
  id: string;
  label?: string;
  type: 'user' | 'follower' | 'following' | 'both' | 'anonymous';
  connection_count: number;
  x?: number;
  y?: number;
  size?: number;
  color?: string;
  community?: number;
  connections?: number;
  // Nouvelles propriétés pour l'analyse des communautés
  community_label?: string;
  migration_status?: 'early_adopter' | 'follower' | 'late_adopter' | 'non_migrated';
  platform_choice?: 'bluesky_only' | 'mastodon_only' | 'multi_platform' | 'twitter_only';
  activity_level?: 'active' | 'dormant' | 'ambassador' | 'abandoner';
  mastodon_instance_type?: 'general' | 'specialized' | 'geographic' | 'ideological' | 'experimental';
  migration_pattern?: 'group' | 'individual' | 'domino' | 'resistant';
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'follower' | 'following';
  color?: string;
  // Nouvelles propriétés pour l'analyse des communautés
  cross_platform?: boolean;
  migration_influence?: number;
}

export interface GraphMetadata {
  total_nodes: number;
  total_edges: number;
  limit_used: number;
  min_connections_used: number;
  anonymous: boolean;
  user_id?: string;
  authenticated?: boolean;
  // Nouvelles métadonnées pour l'analyse des communautés
  analysis_type?: 'basic' | 'community_analysis';
  communities_count?: number;
  migration_metrics?: {
    bluesky_percentage: number;
    mastodon_percentage: number;
    multi_platform_percentage: number;
    early_adopters_percentage: number;
    active_users_percentage: number;
  };
  community_labels?: Record<number, {
    label: string;
    size: number;
    dominant_platform: string;
    migration_timing: string;
    cohesion_level: number;
  }>;
}

export interface CommunityAnalysis {
  community_id: number;
  label: string;
  size: number;
  bluesky_percentage: number;
  mastodon_percentage: number;
  multi_platform_percentage: number;
  early_adopters_percentage: number;
  active_users_percentage: number;
  dominant_migration_pattern: string;
  cohesion_level: number; // 0-100
  instance_diversity: number; // 0-100
  key_metrics: Record<string, number>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: GraphMetadata;
  community_analysis?: CommunityAnalysis[];
}

export type ConnectionType = 'both' | 'followers' | 'following';
export type LayoutType = 'circular' | 'force' | 'community';
export type GraphMode = 'anonymous' | 'personal';