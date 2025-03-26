import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  updateNewsletterPreferences,
  NewsletterData,
  NewsletterPreferencesData,
  NewsletterConsentsData
} from '@/lib/services/newsletterService';

// Types of consents we track
export type ConsentType = 'email_newsletter' | 'personalized_support' | 'research_participation' | 'oep_newsletter'  ;

/**
 * A comprehensive hook for managing all newsletter-related functionality
 */
export function useNewsletter() {
  const { data: session, update } = useSession();
  const userId = session?.user?.id;
  
  // Cache mechanism for API calls
  let lastFetchTime = 0;
  let globalFetchPromise: Promise<NewsletterData> | null = null;
  const CACHE_DURATION = 5000; // 5 seconds cache

  /**
   * Fetches all newsletter data (preferences and consents)
   */
  const fetchNewsletterData = async (): Promise<NewsletterData> => {
    // If we have an existing promise and it's recent, return it
    const now = Date.now();
    if (globalFetchPromise && now - lastFetchTime < CACHE_DURATION) {
      return globalFetchPromise;
    }

    // Otherwise create a new promise and store it
    lastFetchTime = now;
    globalFetchPromise = new Promise<NewsletterData>(async (resolve, reject) => {
      try {
        const response = await fetch('/api/newsletter/request', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          reject(new Error('Failed to fetch newsletter data'));
          return;
        }

        const data = await response.json();

        if (!data.success) {
          reject(new Error('API returned unsuccessful response'));
          return;
        }

        // Map API response to our data structure
        const combinedData: NewsletterData = {
          preferences: {
            email: data.data.email,
            research_accepted: !!data.data.research_accepted,
            oep_accepted: !!data.data.oep_accepted,
            hqx_newsletter: !!data.data.hqx_newsletter,
            have_seen_newsletter: !!data.data.have_seen_newsletter,
          },
          consents: {
            email_newsletter: !!data.data.consents?.email_newsletter,
            personalized_support: !!(data.data.consents?.bluesky_dm || data.data.consents?.mastodon_dm),
            research_participation: !!data.data.consents?.research_participation,
            oep_newsletter: !!data.data.consents?.oep_newsletter
          }
        };

        resolve(combinedData);
      } catch (error) {
        console.error('Error fetching newsletter data:', error);
        reject(error);
      }
    });

    return globalFetchPromise;
  };

  // Newsletter data
  const [newsletterData, setNewsletterData] = useState<NewsletterData>({
    preferences: {
      email: undefined,
      hqx_newsletter: false,
      oep_accepted: false,
      research_accepted: false,
      have_seen_newsletter: false,
      // have_seen_bot_newsletter: false
    },
    consents: {
      email_newsletter: false,
      personalized_support: false,
      research_participation: false,
      oep_newsletter: false
    }
  });
  
  // Loading state
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // UI state
  const [showRequestNewsLetterDMModal, setShowRequestNewsLetterDMModal] = useState(false);
  const [isNewsletterFirstSeenOpen, setIsNewsletterFirstSeenOpen] = useState(false);
  
  // Token check state
  const [isTokenValid, setIsTokenValid] = useState<boolean | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(false);
  const [invalidProviders, setInvalidProviders] = useState<string[]>([]);
  const [mastodonInstances, setMastodonInstances] = useState<string[]>([]);
  
  // Derived states
  const hasBlueskyHandle = !!session?.user?.bluesky_handle || !!session?.user?.bluesky_username;
  const shouldShowPersonalizedSupportModal = 
    hasBlueskyHandle && 
    newsletterData.preferences.hqx_newsletter && 
    !newsletterData.consents.personalized_support && 
    !isNewsletterFirstSeenOpen;
  
  // Fetch newsletter data
  const refreshData = useCallback(async (force = false) => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      
      if (force) {
        // invalidateCache();
      }
      
      const data = await fetchNewsletterData();
      setNewsletterData(data);
    } catch (error) {
      console.error('Error fetching newsletter data:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  // Initial fetch
  useEffect(() => {
    if (userId) {
      refreshData();
    }
  }, [userId, refreshData]);
  
  // Fetch Mastodon instances
  useEffect(() => {
    const fetchMastodonInstances = async () => {
      try {
        const response = await fetch('/api/auth/mastodon');
        if (response.ok) {
          const data = await response.json();
          setMastodonInstances(data.instances || []);
        }
      } catch (error) {
        console.error('Error fetching Mastodon instances:', error);
      }
    };

    fetchMastodonInstances();
  }, []);

  // Vérifier la validité du token
  const checkTokenValidity = useCallback(async () => {
    if (!session?.user?.id) return false;
    
    setIsCheckingToken(true);
    
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setIsTokenValid(true);
        setInvalidProviders([]);
        return true;
      } else {
        setIsTokenValid(false);
        setInvalidProviders(data.providers || []);
        return false;
      }
    } catch (error) {
      console.error('Error checking token validity:', error);
      setIsTokenValid(false);
      return false;
    } finally {
      setIsCheckingToken(false);
    }
  }, [session?.user?.id]);

  // Vérifier le token quand les dépendances changent
  useEffect(() => {
    if (hasBlueskyHandle && isTokenValid === null && !isCheckingToken) {
      checkTokenValidity();
    }
  }, [hasBlueskyHandle, isTokenValid, isCheckingToken, checkTokenValidity]);
  
  // Check if we should show the personalized support modal
  useEffect(() => {
    if (shouldShowPersonalizedSupportModal && !showRequestNewsLetterDMModal && isTokenValid !== false) {
      setShowRequestNewsLetterDMModal(true);
    }
  }, [shouldShowPersonalizedSupportModal, showRequestNewsLetterDMModal, isTokenValid]);
  
  // Update preferences method
  const updatePreferences = async (newPrefs: Partial<NewsletterPreferencesData> & { personalized_support?: boolean }): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      // setIsLoading(true);
      const success = await updateNewsletterPreferences({
        email: newPrefs.email !== undefined ? newPrefs.email : newsletterData.preferences.email,
        hqx_newsletter: newPrefs.hqx_newsletter !== undefined ? newPrefs.hqx_newsletter : newsletterData.preferences.hqx_newsletter,
        oep_accepted: newPrefs.oep_accepted !== undefined ? newPrefs.oep_accepted : newsletterData.preferences.oep_accepted,
        research_accepted: newPrefs.research_accepted !== undefined ? newPrefs.research_accepted : newsletterData.preferences.research_accepted,
        personalized_support: newPrefs.personalized_support !== undefined ? newPrefs.personalized_support : newsletterData.consents.personalized_support
      });
      
      if (success) {
        setNewsletterData(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            ...newPrefs
          },
          consents: {
            ...prev.consents,
            personalized_support: newPrefs.personalized_support !== undefined ? newPrefs.personalized_support : prev.consents.personalized_support
          }
        }));
        // Nous ne mettons plus à jour la session ici car cela cause un rechargement
        // await update();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating preferences:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    } finally {
      // setIsLoading(false);
    }
  };

  // New method to update newsletter with email
  const updateNewsletterWithEmail = async (email: string | undefined, subscribe: boolean): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setIsLoading(true);
      
      // Prepare API request
      const requestBody: any = {
        consents: [{ type: 'email_newsletter', value: subscribe }]
      };
      
      // Add email if subscribing and email is provided
      if (subscribe && email) {
        requestBody.email = email;
      }
      
      // Make direct API call for newsletter update
      const response = await fetch('/api/newsletter/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      if (response.ok) {
        // Update local state
        setNewsletterData(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            hqx_newsletter: subscribe,
            email: subscribe ? email : prev.preferences.email
          },
          consents: {
            ...prev.consents,
            email_newsletter: subscribe
          }
        }));
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating newsletter subscription:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update consents method
  const updateConsents = async (newConsents: Partial<NewsletterConsentsData>): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setIsLoading(true);
      
      // Only handling personalized_support for now as that's all the API supports
      const success = await updateNewsletterPreferences({
        email: newsletterData.preferences.email,
        hqx_newsletter: newsletterData.preferences.hqx_newsletter,
        oep_accepted: newsletterData.preferences.oep_accepted,
        research_accepted: newsletterData.preferences.research_accepted,
        personalized_support: newConsents.personalized_support !== undefined ? newConsents.personalized_support : newsletterData.consents.personalized_support
      });
      
      if (success) {
        setNewsletterData(prev => ({
          ...prev,
          consents: {
            ...prev.consents,
            ...newConsents
          }
        }));
        // await update();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating consents:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Toggle preference
  const togglePreference = async (key: keyof NewsletterPreferencesData): Promise<boolean> => {
    const newValue = !newsletterData.preferences[key];
    const update = { [key]: newValue } as Partial<NewsletterPreferencesData>;
    return updatePreferences(update);
  };
  
  // Toggle consent
  const toggleConsent = async (key: keyof NewsletterConsentsData): Promise<boolean> => {
    const newValue = !newsletterData.consents[key];
    const update = { [key]: newValue } as Partial<NewsletterConsentsData>;
    return updateConsents(update);
  };
  
  // Check if user has consented to a specific type
  const hasConsent = useCallback((consentType: ConsentType): boolean => {
    switch(consentType) {
      case 'email_newsletter': return newsletterData.preferences.hqx_newsletter;
      case 'personalized_support': return !!newsletterData.consents.personalized_support;
      case 'research_participation': return newsletterData.preferences.research_accepted;
      case 'oep_newsletter': return newsletterData.preferences.oep_accepted;
      default: return false;
    }
  }, [newsletterData]);
  
  // Conveniences for common actions
  const toggleHQXNewsletter = () => togglePreference('hqx_newsletter');
  const toggleOEPAccepted = () => togglePreference('oep_accepted');
  const toggleResearchAccepted = () => togglePreference('research_accepted');
  const toggleDMConsent = () => toggleConsent('personalized_support');
  
  return {
    // Preferences data
    preferences: newsletterData.preferences,
    consents: newsletterData.consents,
    
    // Individual preference values (for convenience)
    email: newsletterData.preferences.email,
    hqx_newsletter: newsletterData.preferences.hqx_newsletter,
    oep_accepted: newsletterData.preferences.oep_accepted,
    research_accepted: newsletterData.preferences.research_accepted,
    have_seen_newsletter: newsletterData.preferences.have_seen_newsletter,
    dm_consent: newsletterData.consents.personalized_support,
    
    // Loading state
    isLoading,
    error,
    
    // Newsletter first seen dialog
    isNewsletterFirstSeenOpen,
    setIsNewsletterFirstSeenOpen,
    
    // Token validity
    isTokenValid,
    isCheckingToken,
    invalidProviders,
    mastodonInstances,
    checkTokenValidity,
    
    // Methods - core
    updatePreferences,
    updateConsents,
    togglePreference,
    toggleConsent,
    hasConsent,
    refreshData: (force = false) => refreshData(force),
    
    // Methods - conveniences
    toggleHQXNewsletter,
    toggleOEPAccepted,
    toggleResearchAccepted,
    toggleDMConsent,
    updateNewsletterWithEmail
  };
}

export { useNewsletter as useNewsLetter };
