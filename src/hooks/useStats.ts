import { useCallback, useEffect, useState, useRef } from "react";
import { usePathname } from 'next/navigation';
import { GlobalStats, UserCompleteStats } from "../lib/types/stats";
import { useSSE, SSEGlobalStatsData, SSEUserStatsData } from './useSSE';

// Cookie helpers for global stats caching
const GLOBAL_STATS_COOKIE_NAME = 'global_stats_cache';
const GLOBAL_STATS_COOKIE_EXPIRY_MINUTES = 5; // Cache for 5 minutes

function getGlobalStatsFromCookie(): GlobalStats | null {
  if (typeof document === 'undefined') return null;
  try {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${GLOBAL_STATS_COOKIE_NAME}=`);
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      if (cookieValue) {
        return JSON.parse(decodeURIComponent(cookieValue));
      }
    }
  } catch (e) {
    console.warn('📊 [useStats] Failed to parse global stats cookie:', e);
  }
  return null;
}

function setGlobalStatsCookie(stats: GlobalStats): void {
  if (typeof document === 'undefined') return;
  try {
    const expires = new Date();
    expires.setTime(expires.getTime() + GLOBAL_STATS_COOKIE_EXPIRY_MINUTES * 60 * 1000);
    const serialized = encodeURIComponent(JSON.stringify(stats));
    document.cookie = `${GLOBAL_STATS_COOKIE_NAME}=${serialized};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
  } catch (e) {
    console.warn('📊 [useStats] Failed to set global stats cookie:', e);
  }
}

// Module-level variable to track if stats have been fetched across component instances
const globalDataFetched = { current: false };

// Shared promise to prevent duplicate concurrent fetches
let activeStatsPromise: Promise<void> | null = null;

// Cached results
let cachedGlobalStats: GlobalStats | undefined = undefined;
let cachedUserStats: UserCompleteStats | null = null;

// Global debounce pour refreshStats - partagé entre toutes les instances
let globalRefreshTimeout: ReturnType<typeof setTimeout> | null = null;
const REFRESH_DEBOUNCE_DELAY = 500;

// Compteur pour identifier les instances
let instanceCounter = 0;

export function useStats(options?: { skipInitialFetch?: boolean }) {
    const [stats, setStats] = useState<UserCompleteStats | null>(null);
    const [globalStats, setGlobalStats] = useState<GlobalStats | undefined>(() => {
      // Initialize from cookie if available
      const fromCookie = getGlobalStatsFromCookie();
      if (fromCookie) {
        cachedGlobalStats = fromCookie;
        return fromCookie;
      }
      return undefined;
    });
    const [isLoading, setIsLoading] = useState(true);
    // Initialize local ref with global state
    const dataFetchedRef = useRef(globalDataFetched.current);
    const pathname = usePathname();
    
    // Créer un ID unique pour cette instance
    const instanceId = useRef(`useStats-${++instanceCounter}`);

    // SSE handlers for real-time stats updates
    const handleGlobalStatsSSE = useCallback((data: SSEGlobalStatsData) => {
      console.log('📊 [useStats] SSE global stats update received:', data);
      // Merge SSE data with existing cached stats (SSE only sends partial data)
      const updatedStats: GlobalStats = {
        ...cachedGlobalStats,
        users: { 
          total: data.users, 
          onboarded: cachedGlobalStats?.users?.onboarded || 0 
        },
        connections: { 
          ...cachedGlobalStats?.connections,
          followers: cachedGlobalStats?.connections?.followers || 0,
          following: cachedGlobalStats?.connections?.following || 0,
          withHandle: data.connections,
          withHandleBluesky: cachedGlobalStats?.connections?.withHandleBluesky || 0,
          withHandleMastodon: cachedGlobalStats?.connections?.withHandleMastodon || 0,
          followedOnBluesky: cachedGlobalStats?.connections?.followedOnBluesky || 0,
          followedOnMastodon: cachedGlobalStats?.connections?.followedOnMastodon || 0,
        },
        updated_at: data.updated_at,
      };
      cachedGlobalStats = updatedStats;
      setGlobalStats(updatedStats);
      setGlobalStatsCookie(updatedStats);
    }, []);

    const handleUserStatsSSE = useCallback((data: SSEUserStatsData) => {
      console.log('📊 [useStats] SSE user stats update received:', data);
      const updatedStats: UserCompleteStats = {
        connections: data.connections,
        matches: data.matches,
        updated_at: new Date().toISOString(),
      };
      cachedUserStats = updatedStats;
      setStats(updatedStats);
    }, []);

    // Connect to SSE for real-time updates
    useSSE({
      onGlobalStats: handleGlobalStatsSSE,
      onUserStats: handleUserStatsSSE,
    }, true);

    const fetchStats = useCallback(async (forceRefresh = false) => {
      // Skip fetching if data was already loaded (check both local and global state) and no force refresh is requested
      if ((dataFetchedRef.current || globalDataFetched.current) && !forceRefresh) {
        // Use cached data if available
        if (cachedGlobalStats) {
          setGlobalStats(cachedGlobalStats);
        }
        if (cachedUserStats) {
          setStats(cachedUserStats);
        }
        dataFetchedRef.current = true;
        globalDataFetched.current = true;
        setIsLoading(false);
        return;
      }

      // Reuse active promise if exists
      if (activeStatsPromise && !forceRefresh) {
        console.log('📊 [useStats] Reusing active promise');
        try {
          await activeStatsPromise;
          // After promise resolves, use cached data
          if (cachedGlobalStats) setGlobalStats(cachedGlobalStats);
          if (cachedUserStats) setStats(cachedUserStats);
        } catch (e) {
          // Ignore errors from shared promise
        }
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      
      // Assign promise SYNCHRONOUSLY before any async work to prevent race conditions
      activeStatsPromise = (async () => {
        try {
          const path = (pathname || '').split('?')[0];
          const isReconnect = path.includes('/reconnect');
          const isDashboard = path.includes('/dashboard');

          // Check cookie cache first for global stats (unless force refresh)
          if (!forceRefresh) {
            const cookieStats = getGlobalStatsFromCookie();
            if (cookieStats) {
              console.log('📊 [useStats] Using global stats from cookie cache');
              cachedGlobalStats = cookieStats;
              setGlobalStats(cookieStats);
            }
          }

          // Fetch global stats from API if not in cookie or force refresh
          if (forceRefresh || !cachedGlobalStats) {
            const globalStatsResponse = await fetch('/api/stats/total', { 
              headers: { 
                'Cache-Control': 'no-cache',
                'X-Request-ID': `stats-total-${Date.now()}`
              } 
            });
            const fetchedGlobalStats = await globalStatsResponse.json();
            cachedGlobalStats = fetchedGlobalStats;
            setGlobalStats(fetchedGlobalStats);
            // Save to cookie for future requests
            setGlobalStatsCookie(fetchedGlobalStats);
          }

          // Conditionally fetch user stats only on reconnect pages and not dashboard
          if (isReconnect && !isDashboard) {
            const userStatsResponse = await fetch('/api/stats', { 
              headers: { 
                'Cache-Control': 'no-cache',
                'X-Request-ID': `stats-${Date.now()}`
              } 
            });
            const userStats = await userStatsResponse.json();
            cachedUserStats = userStats;
            setStats(userStats);
          } else {
            setStats(null);
          }
          dataFetchedRef.current = true;
          globalDataFetched.current = true;
        } catch (error) {
          console.error("Error fetching stats:", error);
        } finally {
          setIsLoading(false);
          activeStatsPromise = null;
        }
      })();

      await activeStatsPromise;
    }, [pathname]);
  
    useEffect(() => {
      if (!options?.skipInitialFetch) {
        fetchStats();
      }
      
      // No need for cleanup function as we're using global variables
      // This helps with React Strict Mode's double-mounting behavior
    }, [fetchStats, options?.skipInitialFetch]);
  
    // Global debounced refreshStats - un seul appel même avec multiple instances
    const refreshStats = useCallback(() => {

      // Annuler le timeout précédent s'il existe
      if (globalRefreshTimeout) {
        clearTimeout(globalRefreshTimeout);
      }
      
      // Créer un nouveau timeout global
      globalRefreshTimeout = setTimeout(() => {
        dataFetchedRef.current = false;
        globalDataFetched.current = false;
        fetchStats(true);
        globalRefreshTimeout = null;
      }, REFRESH_DEBOUNCE_DELAY);
    }, [fetchStats]);
  
    return { stats, globalStats, isLoading, refreshStats };
}