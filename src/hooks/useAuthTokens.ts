import { useCallback, useEffect, useState } from "react";

export function useAuthTokens() {
    const [missingProviders, setMissingProviders] = useState<('bluesky' | 'mastodon')[]>([]);
    
    const verifyTokens = useCallback(async () => {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Cache-Control': 'no-cache' }
        });
        const data = await response.json();
        
        if (!data.success && data.providers) {
          setMissingProviders(data.providers);
        }
        
        return { isValid: data.success, providers: data.providers };
      } catch (error) {
        console.error('Error verifying tokens:', error);
        return { isValid: false, error };
      }
    }, []);
    
    useEffect(() => {
      verifyTokens();
    }, [verifyTokens]);
    
    return { missingProviders, verifyTokens };
  }