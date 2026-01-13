'use client';

import { useState, useEffect, useCallback } from 'react';

interface FollowersCoordinatesState {
  hashSet: Set<string>;
  isLoading: boolean;
  error: string | null;
  totalInGraph: number;
}

// Helper to create a hash from coordinates
// Using 6 decimal places for precision (enough for unique identification)
export function coordHash(x: number, y: number): string {
  return `${x.toFixed(6)}_${y.toFixed(6)}`;
}

interface FollowersResponse {
  hashes: string[];
  stats: {
    total_in_graph: number;
  };
}

/**
 * Hook to fetch followers coordinate hashes for graph highlighting.
 * The API now returns hashes directly (x_y format) - no need for DuckDB lookup.
 */
export function useFollowersCoordinates() {
  const [state, setState] = useState<FollowersCoordinatesState>({
    hashSet: new Set(),
    isLoading: true,
    error: null,
    totalInGraph: 0,
  });

  const fetchFollowersCoordinates = useCallback(async () => {
    try {
      console.log('🎯 [FollowersCoords] Fetching follower hashes...');
      
      const response = await fetch('/api/graph/followers-hashes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        // User might not be logged in or have no followers
        if (response.status === 401) {
          console.log('🎯 [FollowersCoords] User not authenticated, skipping');
          setState({
            hashSet: new Set(),
            isLoading: false,
            error: null,
            totalInGraph: 0,
          });
          return;
        }
        throw new Error(`Failed to fetch followers: ${response.status}`);
      }

      const data: FollowersResponse = await response.json();
      const hashes = data.hashes || [];
      const totalInGraph = data.stats?.total_in_graph || hashes.length;
      
      console.log(`🎯 [FollowersCoords] Got ${hashes.length} follower hashes`);

      setState({
        hashSet: new Set(hashes),
        isLoading: false,
        error: null,
        totalInGraph,
      });

    } catch (error) {
      console.error('❌ [FollowersCoords] Error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchFollowersCoordinates();
  }, [fetchFollowersCoordinates]);

  return {
    ...state,
    refetch: fetchFollowersCoordinates,
  };
}
