import { useCallback, useEffect, useState, useRef } from "react";
import { GlobalStats, UserCompleteStats } from "../lib/types/stats";

// Module-level variable to track if stats have been fetched across component instances
const globalDataFetched = { current: false };

export function useStats() {
    const [stats, setStats] = useState<UserCompleteStats | null>(null);
    const [globalStats, setGlobalStats] = useState<GlobalStats | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    // Initialize local ref with global state
    const dataFetchedRef = useRef(globalDataFetched.current);
  
    const fetchStats = useCallback(async (forceRefresh = false) => {
      // Skip fetching if data was already loaded (check both local and global state) and no force refresh is requested
      if ((dataFetchedRef.current || globalDataFetched.current) && !forceRefresh) {
        dataFetchedRef.current = true;
        globalDataFetched.current = true;
        return;
      }
      
      try {
        console.log("Fetching stats...");
        setIsLoading(true);
        const [userStatsResponse, globalStatsResponse] = await Promise.all([
          fetch('/api/stats', { 
            headers: { 
              'Cache-Control': 'no-cache',
              'X-Request-ID': `stats-${Date.now()}` // Add unique identifier to prevent browser caching
            } 
          }),
          fetch('/api/stats/total', { 
            headers: { 
              'Cache-Control': 'no-cache',
              'X-Request-ID': `stats-total-${Date.now()}` // Add unique identifier to prevent browser caching
            } 
          })
        ]);
  
        const userStats = await userStatsResponse.json();
        const globalStats = await globalStatsResponse.json();
        
        setStats(userStats);
        setGlobalStats(globalStats);
        dataFetchedRef.current = true;
        globalDataFetched.current = true;
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    }, []);
  
    useEffect(() => {
      fetchStats();
      
      // No need for cleanup function as we're using global variables
      // This helps with React Strict Mode's double-mounting behavior
    }, [fetchStats]);
  
    // Modified refreshStats to force a refresh and reset both local and global flags
    const refreshStats = useCallback(() => {
      dataFetchedRef.current = false;
      globalDataFetched.current = false;
      return fetchStats(true);
    }, [fetchStats]);
  
    return { stats, globalStats, isLoading, refreshStats };
  }