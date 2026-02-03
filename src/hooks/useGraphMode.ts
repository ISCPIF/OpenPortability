'use client';

import { useMemo } from 'react';
import { usePublicGraphDataV3Optional } from '@/contexts/PublicGraphDataContextV3';
import { useGraphDataOptional } from '@/contexts/GraphDataContext';
import { GraphNode } from '@/lib/types/graph';
import { FollowingHashStatus } from '@/hooks/usePersonalNetwork';

interface FloatingLabel {
  coord_hash: string;
  x: number;
  y: number;
  text: string;
  priority: number;
  level: number;
}

interface NormalizationBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  scale: number;
  centerX: number;
  centerY: number;
}

interface GraphModeData {
  // Base nodes (from either context)
  baseNodes: GraphNode[];
  isBaseNodesLoaded: boolean;
  isBaseNodesLoading: boolean;
  fetchBaseNodes: () => Promise<void>;
  
  // Normalization bounds
  normalizationBounds: NormalizationBounds | null;
  
  // Labels (public labels for discover mode)
  labelMap: Record<string, string>;
  floatingLabels: FloatingLabel[];
  isLabelsLoaded: boolean;
  isLabelsLoading: boolean;
  fetchLabels: () => Promise<void>;
  
  // Personal data (only available in authenticated mode)
  followingHashes: Map<string, FollowingHashStatus>;
  followerHashes: Set<string>;
  userNode: { x: number; y: number; label: string | null; community: number | null; tier: string | null; degree: number } | null;
  isHashesLoading: boolean;
  fetchHashes: () => Promise<void>;
  
  // Mode info
  isAuthenticated: boolean;
  hasPersonalData: boolean;
}

/**
 * Hook that provides graph data based on authentication status.
 * 
 * - For non-authenticated users: Uses PublicGraphDataContextV3 (discover mode only)
 * - For authenticated users: Uses GraphDataContext (full features)
 * 
 * This allows the graph to work in both modes without requiring auth.
 */
export function useGraphMode(isAuthenticated: boolean): GraphModeData {
  const publicData = usePublicGraphDataV3Optional();
  const authData = useGraphDataOptional();
  
  // Empty set/map for non-authenticated mode
  const emptySet = useMemo(() => new Set<string>(), []);
  const emptyMap = useMemo(() => new Map<string, FollowingHashStatus>(), []);
  const emptyRecord = useMemo(() => ({}), []);
  const emptyArray = useMemo(() => [] as FloatingLabel[], []);
  const noopAsync = useMemo(() => async () => {}, []);
  
  return useMemo<GraphModeData>(() => {
    // If authenticated and authData is available, use it
    if (isAuthenticated && authData) {
      return {
        // Base nodes
        baseNodes: authData.baseNodes,
        isBaseNodesLoaded: authData.isBaseNodesLoaded,
        isBaseNodesLoading: authData.isBaseNodesLoading,
        fetchBaseNodes: authData.fetchBaseNodes,
        
        // Normalization bounds
        normalizationBounds: authData.normalizationBounds,
        
        // Labels (from auth context)
        labelMap: authData.personalLabelMap,
        floatingLabels: authData.personalFloatingLabels,
        isLabelsLoaded: authData.isPersonalLabelsLoaded,
        isLabelsLoading: authData.isPersonalLabelsLoading,
        fetchLabels: authData.fetchPersonalLabels,
        
        // Personal data
        followingHashes: authData.followingHashes,
        followerHashes: authData.followerHashes,
        userNode: authData.userNode,
        isHashesLoading: authData.isHashesLoading,
        fetchHashes: authData.fetchHashes,
        
        // Mode info
        isAuthenticated: true,
        hasPersonalData: authData.followingHashes.size > 0 || authData.followerHashes.size > 0,
      };
    }
    
    // If public data is available, use it (discover mode)
    if (publicData) {
      return {
        // Base nodes
        baseNodes: publicData.mergedNodes.length > 0 ? publicData.mergedNodes : publicData.initialNodes,
        isBaseNodesLoaded: publicData.isInitialLoaded,
        isBaseNodesLoading: publicData.isInitialLoading,
        fetchBaseNodes: publicData.fetchInitialNodes,
        
        // Normalization bounds
        normalizationBounds: publicData.normalizationBounds,
        
        // Labels (public)
        labelMap: publicData.labelMap,
        floatingLabels: publicData.floatingLabels,
        isLabelsLoaded: publicData.isLabelsLoaded,
        isLabelsLoading: publicData.isLabelsLoading,
        fetchLabels: publicData.fetchLabels,
        
        // No personal data in public mode
        followingHashes: emptyMap,
        followerHashes: emptySet,
        userNode: null,
        isHashesLoading: false,
        fetchHashes: noopAsync,
        
        // Mode info
        isAuthenticated: false,
        hasPersonalData: false,
      };
    }
    
    // Fallback: no context available
    return {
      baseNodes: [],
      isBaseNodesLoaded: false,
      isBaseNodesLoading: false,
      fetchBaseNodes: noopAsync,
      normalizationBounds: null,
      labelMap: emptyRecord,
      floatingLabels: emptyArray,
      isLabelsLoaded: false,
      isLabelsLoading: false,
      fetchLabels: noopAsync,
      followingHashes: emptyMap,
      followerHashes: emptySet,
      userNode: null,
      isHashesLoading: false,
      fetchHashes: noopAsync,
      isAuthenticated: false,
      hasPersonalData: false,
    };
  }, [isAuthenticated, authData, publicData, emptySet, emptyMap, emptyRecord, emptyArray, noopAsync]);
}
