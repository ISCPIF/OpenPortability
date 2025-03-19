import { ConsentType } from '../../hooks/useNewsLetter';

// Types
export interface NewsletterPreferencesData {
  email?: string;
  hqx_newsletter: boolean;
  oep_accepted: boolean;
  research_accepted: boolean;
  have_seen_newsletter: boolean;
  have_seen_bot_newsletter: boolean;
}

export interface NewsletterConsentsData {
  email_newsletter?: boolean;
  bluesky_dm?: boolean;
  research_participation?: boolean;
  oep_newsletter?: boolean;
}

export interface NewsletterData {
  preferences: NewsletterPreferencesData;
  consents: NewsletterConsentsData;
}

// Cache mechanism
let globalFetchPromise: Promise<NewsletterData> | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5000; // 5 seconds cache

/**
 * Fetches all newsletter data (preferences and consents)
 */
export const fetchNewsletterData = async (): Promise<NewsletterData> => {
  // If we have an existing promise and it's recent, return it
  const now = Date.now();
  if (globalFetchPromise && now - lastFetchTime < CACHE_DURATION) {
    return globalFetchPromise;
  }

  // Otherwise create a new promise and store it
  lastFetchTime = now;
  globalFetchPromise = new Promise<NewsletterData>(async (resolve, reject) => {
    try {
      // Fetch preferences from user table
      const preferencesResponse = await fetch('/api/newsletter', { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!preferencesResponse.ok) {
        reject(new Error('Failed to fetch newsletter preferences'));
        return;
      }
      
      // Fetch consent data from the new API endpoint
      const consentsResponse = await fetch('/api/newsletter/request', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!consentsResponse.ok) {
        console.error('Failed to fetch consent data, continuing with just preferences');
      }
      
      const preferencesData = await preferencesResponse.json();
      let consentsData = { success: false, data: {} as NewsletterConsentsData };
      
      try {
        if (consentsResponse.ok) {
          consentsData = await consentsResponse.json();
          // Make sure data is always at least an empty object
          if (!consentsData.data) consentsData.data = {} as NewsletterConsentsData;
        }
      } catch (error) {
        console.error('Error parsing consents response:', error);
      }
      
      // Get bot newsletter status
      let haveBotNewsletter = false;
      try {
        // Utilisez les données de l'utilisateur depuis la session
        const userResponse = await fetch('/api/auth/session', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          haveBotNewsletter = userData?.user?.have_seen_bot_newsletter ?? false;
        }
      } catch (error) {
        console.error('Error getting user session data:', error);
      }
      
      // Combine data
      const combinedData: NewsletterData = {
        preferences: {
          email: preferencesData.data.email,
          research_accepted: !!preferencesData.data.research_accepted,
          oep_accepted: !!preferencesData.data.oep_accepted,
          hqx_newsletter: !!preferencesData.data.hqx_newsletter,
          have_seen_newsletter: !!preferencesData.data.have_seen_newsletter,
          have_seen_bot_newsletter: haveBotNewsletter
        },
        consents: consentsData.data
      };
      
      resolve(combinedData);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error'));
    }
  });

  return globalFetchPromise;
};

/**
 * Updates newsletter preferences
 */
export const updateNewsletterPreferences = async (
  data: {
    email?: string;
    acceptHQX?: boolean;
    acceptOEP?: boolean;
    research_accepted?: boolean;
    dm_consent?: boolean;
  }
): Promise<boolean> => {
  try {
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update preferences');
    }
    
    // After successfully updating, invalidate the cache
    invalidateCache();
    
    return true;
  } catch (error) {
    console.error('Error updating newsletter preferences:', error);
    return false;
  }
};

/**
 * Updates bot newsletter seen status
 */
export const updateBotNewsletterSeen = async (
  userId: string,
  haveSeenBotNewsletter: boolean
): Promise<boolean> => {
  try {
    const response = await fetch('/api/users/bot-newsletter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        haveSeenBotNewsletter,
      }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to update bot newsletter status');
    }
    
    // After successfully updating, invalidate the cache
    invalidateCache();
    
    return true;
  } catch (error) {
    console.error('Error updating bot newsletter status:', error);
    return false;
  }
};

/**
 * Invalidates the cache to force a refresh on next fetch
 */
export const invalidateCache = (): void => {
  globalFetchPromise = null;
  lastFetchTime = 0;
};

/**
 * Maps consent types to their values
 */
export const mapConsentToValue = (
  consentType: ConsentType,
  preferences: NewsletterPreferencesData,
  consents: NewsletterConsentsData
): boolean => {
  switch(consentType) {
    case 'email_newsletter': return preferences.hqx_newsletter;
    case 'bluesky_dm': return !!consents.bluesky_dm;
    case 'research_participation': return preferences.research_accepted;
    case 'oep_newsletter': return preferences.oep_accepted;
    default: return false;
  }
};