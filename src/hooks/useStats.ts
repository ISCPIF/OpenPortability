import { useCallback, useEffect, useState, useRef } from "react";
import { usePathname } from 'next/navigation';
import { GlobalStats, UserCompleteStats } from "../lib/types/stats";

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
    const [globalStats, setGlobalStats] = useState<GlobalStats | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    // Initialize local ref with global state
    const dataFetchedRef = useRef(globalDataFetched.current);
    const pathname = usePathname();
    
    // Créer un ID unique pour cette instance
    const instanceId = useRef(`useStats-${++instanceCounter}`);

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

          // Always fetch global stats
          const globalStatsResponse = await fetch('/api/stats/total', { 
            headers: { 
              'Cache-Control': 'no-cache',
              'X-Request-ID': `stats-total-${Date.now()}`
            } 
          });
          const fetchedGlobalStats = await globalStatsResponse.json();
          cachedGlobalStats = fetchedGlobalStats;
          setGlobalStats(fetchedGlobalStats);

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