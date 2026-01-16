import { useEffect, useState } from "react";

const STORAGE_KEY = 'mastodon_instances';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface CachedInstances {
  instances: string[];
  timestamp: number;
}

export function useMastodonInstances() {
    const [mastodonInstances, setMastodonInstances] = useState<string[]>([]);
    
    useEffect(() => {
      const fetchMastodonInstances = async () => {
        try {
          // 1. Check sessionStorage first
          const cached = sessionStorage.getItem(STORAGE_KEY);
          if (cached) {
            const { instances, timestamp }: CachedInstances = JSON.parse(cached);
            const isExpired = Date.now() - timestamp > CACHE_DURATION_MS;
            
            if (!isExpired && instances.length > 0) {
              setMastodonInstances(instances);
              return; // Use cached data, skip API call
            }
          }
          
          // 2. Fetch from API if no cache or expired
          const response = await fetch('/api/auth/mastodon');
          const data = await response.json();
          
          if (data.instances && Array.isArray(data.instances)) {
            setMastodonInstances(data.instances);
            
            // 3. Store in sessionStorage with timestamp
            const cacheData: CachedInstances = {
              instances: data.instances,
              timestamp: Date.now()
            };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cacheData));
          }
        } catch (error) {
          console.error('Error fetching Mastodon instances:', error);
          
          // Fallback: try to use expired cache if API fails
          const cached = sessionStorage.getItem(STORAGE_KEY);
          if (cached) {
            const { instances }: CachedInstances = JSON.parse(cached);
            if (instances.length > 0) {
              setMastodonInstances(instances);
            }
          }
        }
      };
      
      fetchMastodonInstances();
    }, []);
    
    return mastodonInstances;
  }