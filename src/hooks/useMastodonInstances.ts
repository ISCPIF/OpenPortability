import { useEffect, useState } from "react";

export function useMastodonInstances() {
    const [mastodonInstances, setMastodonInstances] = useState<string[]>([]);
    
    useEffect(() => {
      const fetchMastodonInstances = async () => {
        try {
          const response = await fetch('/api/auth/mastodon');
          const data = await response.json();
          // L'API retourne { instances: [...] } directement
          if (data.instances && Array.isArray(data.instances)) {
            setMastodonInstances(data.instances);
          }
        } catch (error) {
          console.error('Error fetching Mastodon instances:', error);
        }
      };
      
      fetchMastodonInstances();
    }, []);
    
    return mastodonInstances;
  }