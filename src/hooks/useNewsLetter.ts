import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  fetchNewsletterData,
  updateNewsletterPreferences,
  updateBotNewsletterSeen,
  NewsletterData,
  NewsletterPreferencesData,
  NewsletterConsentsData,
  invalidateCache
} from '@/lib/services/newsletterService';

// Types of consents we track
export type ConsentType = 'email_newsletter' | 'bluesky_dm' | 'research_participation' | 'oep_newsletter';

/**
 * A comprehensive hook for managing all newsletter-related functionality
 */
export function useNewsletter() {
  const { data: session, update } = useSession();
  const userId = session?.user?.id;
  
  // Newsletter data
  const [newsletterData, setNewsletterData] = useState<NewsletterData>({
    preferences: {
      email: undefined,
      hqx_newsletter: false,
      oep_accepted: false,
      research_accepted: false,
      have_seen_newsletter: false,
      have_seen_bot_newsletter: false
    },
    consents: {
      email_newsletter: false,
      bluesky_dm: false,
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
  const shouldShowBotNewsletterModal = 
    hasBlueskyHandle && 
    newsletterData.preferences.hqx_newsletter && 
    !newsletterData.preferences.have_seen_bot_newsletter && 
    !isNewsletterFirstSeenOpen;
  
  // Fetch newsletter data
  const refreshData = useCallback(async (force = false) => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      
      if (force) {
        invalidateCache();
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
  
  // Check if we should show the bot newsletter modal
  useEffect(() => {
    if (shouldShowBotNewsletterModal && !showRequestNewsLetterDMModal && isTokenValid !== false) {
      setShowRequestNewsLetterDMModal(true);
      console.log("use Effect setting a true ShowRequestNewsLetterDMModal")

    }

    console.log("use Effect ShowRequestNewsLetterDMModal")
  }, [shouldShowBotNewsletterModal, showRequestNewsLetterDMModal, isTokenValid]);
  
  // Mark bot newsletter as seen when modal is shown
  useEffect(() => {
    const markAsSeen = async () => {
      if (
        showRequestNewsLetterDMModal && 
        !newsletterData.preferences.have_seen_bot_newsletter && 
        userId
      ) {
        await markBotNewsletterSeen();
      }
    };
    
    markAsSeen();
  }, [showRequestNewsLetterDMModal, newsletterData.preferences.have_seen_bot_newsletter, userId]);
  
  // Update preferences method
  const updatePreferences = async (newPrefs: Partial<NewsletterPreferencesData>): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setIsLoading(true);
      const success = await updateNewsletterPreferences({
        email: newPrefs.email !== undefined ? newPrefs.email : newsletterData.preferences.email,
        acceptHQX: newPrefs.hqx_newsletter !== undefined ? newPrefs.hqx_newsletter : newsletterData.preferences.hqx_newsletter,
        acceptOEP: newPrefs.oep_accepted !== undefined ? newPrefs.oep_accepted : newsletterData.preferences.oep_accepted,
        research_accepted: newPrefs.research_accepted !== undefined ? newPrefs.research_accepted : newsletterData.preferences.research_accepted,
        dm_consent: newsletterData.consents.bluesky_dm
      });
      
      if (success) {
        setNewsletterData(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            ...newPrefs
          }
        }));
        await update();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating preferences:', error);
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
      
      // Only handling dm_consent for now as that's all the API supports
      const success = await updateNewsletterPreferences({
        email: newsletterData.preferences.email,
        acceptHQX: newsletterData.preferences.hqx_newsletter,
        acceptOEP: newsletterData.preferences.oep_accepted,
        research_accepted: newsletterData.preferences.research_accepted,
        dm_consent: newConsents.bluesky_dm !== undefined ? newConsents.bluesky_dm : newsletterData.consents.bluesky_dm
      });
      
      if (success) {
        setNewsletterData(prev => ({
          ...prev,
          consents: {
            ...prev.consents,
            ...newConsents
          }
        }));
        await update();
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
      case 'bluesky_dm': return !!newsletterData.consents.bluesky_dm;
      case 'research_participation': return newsletterData.preferences.research_accepted;
      case 'oep_newsletter': return newsletterData.preferences.oep_accepted;
      default: return false;
    }
  }, [newsletterData]);
  
  // Mark bot newsletter as seen
  const markBotNewsletterSeen = async (): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setIsLoading(true);
      const success = await updateBotNewsletterSeen(userId, true);
      
      if (success) {
        setNewsletterData(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            have_seen_bot_newsletter: true
          }
        }));
        await update();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking bot newsletter as seen:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reset bot newsletter seen
  const resetBotNewsletterSeen = async (): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      setIsLoading(true);
      const success = await updateBotNewsletterSeen(userId, false);
      
      if (success) {
        setNewsletterData(prev => ({
          ...prev,
          preferences: {
            ...prev.preferences,
            have_seen_bot_newsletter: false
          }
        }));
        await update();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error resetting bot newsletter seen:', error);
      setError(error instanceof Error ? error : new Error('Unknown error'));
      return false;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Conveniences for common actions
  const toggleHQXNewsletter = () => togglePreference('hqx_newsletter');
  const toggleOEPAccepted = () => togglePreference('oep_accepted');
  const toggleResearchAccepted = () => togglePreference('research_accepted');
  const toggleDMConsent = () => toggleConsent('bluesky_dm');
  
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
    have_seen_bot_newsletter: newsletterData.preferences.have_seen_bot_newsletter,
    dm_consent: newsletterData.consents.bluesky_dm,
    
    // Loading state
    isLoading,
    error,
    isReady: !isLoading && !!userId,
    
    // Derived states
    hasBlueskyHandle,
    shouldShowBotNewsletterModal,
    
    // UI states
    showRequestNewsLetterDMModal,
    setShowRequestNewsLetterDMModal,
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
    
    // Methods - bot newsletter
    resetBotNewsletterSeen,
    markBotNewsletterSeen
  };
}

export { useNewsletter as useNewsLetter };
