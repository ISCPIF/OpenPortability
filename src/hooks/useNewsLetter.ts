import { useEffect, useState } from "react";

interface NewsletterPreferences {
  research_accepted: boolean;
  oep_accepted: boolean;
  oep_newsletter: boolean;
}

// Create a module-level variable to store the in-flight promise
let globalFetchPromise: Promise<NewsletterPreferences> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

// Helper function to fetch newsletter preferences
const fetchNewsletterData = async (): Promise<NewsletterPreferences> => {
  // If we have an existing promise and it's recent, return it
  const now = Date.now();
  if (globalFetchPromise && now - lastFetchTime < CACHE_DURATION) {
    return globalFetchPromise;
  }

  // Otherwise create a new promise and store it
  lastFetchTime = now;
  globalFetchPromise = new Promise<NewsletterPreferences>(async (resolve, reject) => {
    try {
      const response = await fetch('/api/newsletter', { method: 'GET' });
      if (response.ok) {
        const responseData = await response.json();
        const preferencesData = responseData.data;
        const preferences = {
          research_accepted: !!preferencesData.research_accepted,
          oep_accepted: !!preferencesData.oep_accepted,
          oep_newsletter: !!preferencesData.oep_newsletter
        };
        resolve(preferences);
      } else {
        reject(new Error('Failed to fetch newsletter preferences'));
      }
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error'));
    }
  });

  return globalFetchPromise;
};

export function useNewsLetter() {
  const [preferences, setPreferences] = useState<NewsletterPreferences>({
    research_accepted: false,
    oep_accepted: false,
    oep_newsletter: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchNewsletterPreferences = async () => {
      try {
        setIsLoading(true);
        const data = await fetchNewsletterData();
        setPreferences(data);
      } catch (error) {
        console.error('Error fetching newsletter preferences:', error);
        setError(error instanceof Error ? error : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchNewsletterPreferences();
  }, []);

  const updatePreferences = async (newPreferences: Partial<NewsletterPreferences>) => {
    try {
      setIsLoading(true);
      const updatedPreferences = { ...preferences, ...newPreferences };
      
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          acceptOEP: updatedPreferences.oep_accepted,
          research_accepted: updatedPreferences.research_accepted,
          oep_newsletter: updatedPreferences.oep_newsletter,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update preferences');
      }

      setPreferences(updatedPreferences);
      
      // After successfully updating, invalidate the cache to force a refresh
      globalFetchPromise = null;
      
      return true;
    } catch (error) {
      console.error('Error updating preferences:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    preferences,
    isLoading,
    error,
    updatePreferences
  };
}