'use client';

/**
 * usePersonalNetwork - Hook for Lasso functionality ONLY
 * 
 * IMPORTANT: Personal data (matching, followingHashes, followerHashes) is now
 * managed by GraphDataContext. This hook only handles lasso-related state.
 * 
 * For personal data, use:
 * - graphData.fetchPersonalData() - to load matching + hashes
 * - graphData.followingHashes - Map of following coord_hashes
 * - graphData.followerHashes - Set of follower coord_hashes
 * - graphData.matchingData - Array of MatchingTarget
 */

import { useState, useCallback, useEffect } from 'react';
import { GraphNode } from '@/lib/types/graph';

// ============================================================================
// Types
// ============================================================================

export interface LassoStats {
  pending: number;
  completed: number;
  failed: number;
  total: number;
}

export interface LassoConnection {
  id: string;
  target_twitter_id: string;
  platform: 'bluesky' | 'mastodon';
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  created_at: Date;
  completed_at?: Date;
  bluesky_handle?: string | null;
  mastodon_handle?: string | null;
  tier?: string | null;
  community?: number | null;
  coord_hash?: string | null;
}

// Re-export for backward compatibility
export interface FollowingHashStatus {
  hasBlueskyFollow: boolean;
  hasMastodonFollow: boolean;
  hasMatching: boolean;
}

interface LassoState {
  lassoStats: LassoStats | null;
  lassoCompleted: LassoConnection[];
  lassoFailed: LassoConnection[];
  lassoPending: LassoConnection[];
  lassoLoading: boolean;
  connectedHashes: Set<string>;
}

// Empty stable Set for initial state
const EMPTY_SET = new Set<string>();

// Global lasso state cache (survives navigation)
const getLassoGlobalState = () => {
  if (typeof window !== 'undefined') {
    if (!(window as any).__lassoState) {
      (window as any).__lassoState = {
        stats: null as LassoStats | null,
        completed: [] as LassoConnection[],
        failed: [] as LassoConnection[],
        pending: [] as LassoConnection[],
        connectedHashes: new Set<string>(),
      };
    }
    return (window as any).__lassoState;
  }
  return {
    stats: null,
    completed: [],
    failed: [],
    pending: [],
    connectedHashes: new Set<string>(),
  };
};

// ============================================================================
// Hook
// ============================================================================

export function usePersonalNetwork(_allGraphNodes: GraphNode[]) {
  // Lasso state
  const [state, setState] = useState<LassoState>({
    lassoStats: null,
    lassoCompleted: [],
    lassoFailed: [],
    lassoPending: [],
    lassoLoading: false,
    connectedHashes: EMPTY_SET,
  });

  // Restore lasso state from global cache on mount
  useEffect(() => {
    const globalState = getLassoGlobalState();
    if (globalState.stats || globalState.connectedHashes.size > 0) {
      console.log('🎯 [PersonalNetwork] Restoring lasso state from cache');
      setState(prev => ({
        ...prev,
        lassoStats: globalState.stats || prev.lassoStats,
        lassoCompleted: globalState.completed || prev.lassoCompleted,
        lassoFailed: globalState.failed || prev.lassoFailed,
        lassoPending: globalState.pending || prev.lassoPending,
        connectedHashes: globalState.connectedHashes || prev.connectedHashes,
      }));
    }
  }, []);

  // Fetch lasso stats and connections
  const fetchLassoStats = useCallback(async () => {
    setState(prev => ({ ...prev, lassoLoading: true }));
    
    try {
      const response = await fetch('/api/stats/lasso', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch lasso stats: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const newConnectedHashes = new Set<string>(data.connectedHashes || []);
        
        // Update global cache
        const globalState = getLassoGlobalState();
        globalState.stats = data.stats;
        globalState.completed = data.completed || [];
        globalState.failed = data.failed || [];
        globalState.pending = data.pending || [];
        globalState.connectedHashes = newConnectedHashes;
        
        setState(prev => ({
          ...prev,
          lassoStats: data.stats,
          lassoCompleted: data.completed || [],
          lassoFailed: data.failed || [],
          lassoPending: data.pending || [],
          lassoLoading: false,
          connectedHashes: newConnectedHashes,
        }));
        
        console.log('🎯 [PersonalNetwork] Lasso stats loaded:', data.stats, 'connectedHashes:', newConnectedHashes.size);
      }
    } catch (error) {
      console.error('❌ [PersonalNetwork] Error fetching lasso stats:', error);
      setState(prev => ({ ...prev, lassoLoading: false }));
    }
  }, []);

  return {
    // Lasso state
    lassoStats: state.lassoStats,
    lassoCompleted: state.lassoCompleted,
    lassoFailed: state.lassoFailed,
    lassoPending: state.lassoPending,
    lassoLoading: state.lassoLoading,
    connectedHashes: state.connectedHashes,
    
    // Lasso function
    fetchLassoStats,
  };
}
