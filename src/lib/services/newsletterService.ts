import { ConsentType } from '../../hooks/useNewsLetter';

// Types
export interface NewsletterPreferencesData {
  email?: string;
  hqx_newsletter: boolean;
  oep_accepted: boolean;
  research_accepted: boolean;
  have_seen_newsletter: boolean;
}

export interface NewsletterConsentsData {
  email_newsletter?: boolean;
  personalized_support?: boolean;
  research_participation?: boolean;
  oep_newsletter?: boolean;
}

export interface NewsletterData {
  preferences: NewsletterPreferencesData;
  consents: NewsletterConsentsData;
}

/**
 * Updates newsletter preferences and consents
 */
export const updateNewsletterPreferences = async (
  data: {
    email?: string;
    hqx_newsletter?: boolean;
    oep_accepted?: boolean;
    research_accepted?: boolean;
    personalized_support?: boolean;
  }
): Promise<boolean> => {
  try {
    // Update preferences
    const response = await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        hqx_newsletter: data.hqx_newsletter,
        oep_accepted: data.oep_accepted,
        research_accepted: data.research_accepted
      })
    });
    
    if (!response.ok) {
      console.error('Failed to update newsletter preferences');
      return false;
    }
    
    // Update personalized support consent if provided
    if (typeof data.personalized_support !== 'undefined') {
      const consentResponse = await fetch('/api/newsletter/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'personalized_support',
          value: data.personalized_support
        })
      });
      
      if (!consentResponse.ok) {
        console.error('Failed to update personalized support consent');
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error updating newsletter preferences:', error);
    return false;
  }
};