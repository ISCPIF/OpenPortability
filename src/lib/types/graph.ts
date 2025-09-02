export interface GraphNode {
    id: string;
    label: string;
    x: number;
    y: number;
    size: number;
    color: string;
    community?: number;
    degree?: number;
    language?: string;
    popularity?: number;
    name?: string;
  }
  
  export interface GraphEdge {
    source: string;
    target: string;
    size?: number;
    color?: string;
  }
  
  export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
  }
  
  export type ViewMode = 'anonyme' | 'connexions' | 'migrations';
  
  export interface GraphStats {
    totalNodes: number;
    totalEdges: number;
    totalCommunities: number;
    reconnectedCount?: number;
    totalFollowing?: number;
    totalFollowers?: number;
    foundInGraph?: number;
  }
  