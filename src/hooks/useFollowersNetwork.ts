'use client';

import { useState, useCallback, useEffect } from 'react';

interface FollowersNetworkState {
  followerHashes: Set<string>;
  isLoading: boolean;
  error: string | null;
  totalInGraph: number;
  hasFetched: boolean;
}

// Global state shared with useReconnectState to prevent duplicate API calls
const getGlobalFollowersState = () => {
  if (typeof window !== 'undefined') {
    if (!(window as any).__followersNetworkState) {
      (window as any).__followersNetworkState = {
        fetched: false,
        data: null as string[] | null,
        promise: null as Promise<string[]> | null,
      };
    }
    return (window as any).__followersNetworkState;
  }
  return { fetched: false, data: null, promise: null };
};

interface FollowersResponse {
  hashes: string[];
  stats: {
    total_in_graph: number;
  };
}

/**
 * Hook to fetch and manage follower coordinate hashes for graph highlighting.
 * The API now returns hashes directly (x_y format) instead of follower objects.
 * No need for graph node lookup - hashes are ready to use for highlighting.
 */
export function useFollowersNetwork() {
  const [state, setState] = useState<FollowersNetworkState>({
    followerHashes: new Set<string>(),
    isLoading: false,
    error: null,
    totalInGraph: 0,
    hasFetched: false,
  });

  const fetchFollowersNetwork = useCallback(async () => {
    const globalState = getGlobalFollowersState();
    
    // Prevent multiple fetches
    if (state.hasFetched || globalState.fetched) {
      console.log('📊 [FollowersNetwork] Skipping fetch - already fetched');
      // If we have cached data, use it
      if (globalState.data && globalState.data.length > 0 && state.followerHashes.size === 0) {
        setState({
          followerHashes: new Set(globalState.data),
          isLoading: false,
          error: null,
          totalInGraph: globalState.data.length,
          hasFetched: true,
        });
      }
      return;
    }

    if (state.isLoading) {
      console.log('📊 [FollowersNetwork] Skipping fetch - already loading');
      return;
    }

    // Reuse active promise if exists
    if (globalState.promise) {
      console.log('📊 [FollowersNetwork] Reusing active promise');
      try {
        const hashes = await globalState.promise;
        setState({
          followerHashes: new Set(hashes),
          isLoading: false,
          error: null,
          totalInGraph: hashes.length,
          hasFetched: true,
        });
      } catch (error) {
        console.error('❌ [FollowersNetwork] Error from shared promise:', error);
      }
      return;
    }
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    globalState.promise = (async (): Promise<string[]> => {
      const response = await fetch('/api/graph/followers-hashes', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Request-ID': `followers-network-${Date.now()}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch followers network: ${response.status}`);
      }

      const data: FollowersResponse = await response.json();
      const hashes = data.hashes || [];
      globalState.data = hashes;
      globalState.fetched = true;
      console.log('📊 [FollowersNetwork] Fetched', hashes.length, 'follower hashes');
      return hashes;
    })();

    try {
      const hashes = await globalState.promise;
      setState({
        followerHashes: new Set(hashes),
        isLoading: false,
        error: null,
        totalInGraph: hashes.length,
        hasFetched: true,
      });
    } catch (error) {
      console.error('❌ [FollowersNetwork] Error:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        hasFetched: true,
      }));
    } finally {
      globalState.promise = null;
    }
  }, [state.hasFetched, state.isLoading, state.followerHashes.size]);

  // Load cached data on mount if available
  useEffect(() => {
    const globalState = getGlobalFollowersState();
    if (
      globalState.fetched && 
      globalState.data && 
      globalState.data.length > 0 &&
      state.followerHashes.size === 0 &&
      !state.isLoading
    ) {
      console.log('📊 [FollowersNetwork] Loading cached hashes:', globalState.data.length);
      setState({
        followerHashes: new Set(globalState.data),
        isLoading: false,
        error: null,
        totalInGraph: globalState.data.length,
        hasFetched: true,
      });
    }
  }, [state.followerHashes.size, state.isLoading]);

  return {
    ...state,
    fetchFollowersNetwork,
  };
}
