import { useCallback, useEffect, useState } from "react";
import { GlobalStats, UserCompleteStats } from "../lib/types/stats";

export function useStats() {
    const [stats, setStats] = useState<UserCompleteStats | null>(null);
    const [globalStats, setGlobalStats] = useState<GlobalStats | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
  
    const fetchStats = useCallback(async () => {
      try {
        const [userStatsResponse, globalStatsResponse] = await Promise.all([
          fetch('/api/stats', { headers: { 'Cache-Control': 'no-cache' } }),
          fetch('/api/stats/total', { headers: { 'Cache-Control': 'no-cache' } })
        ]);
  
        const userStats = await userStatsResponse.json();
        const globalStats = await globalStatsResponse.json();
        
        setStats(userStats);
        setGlobalStats(globalStats);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching stats:", error);
        setIsLoading(false);
      }
    }, []);
  
    useEffect(() => {
      fetchStats();
    }, [fetchStats]);
  
    return { stats, globalStats, isLoading, refreshStats: fetchStats };
  }