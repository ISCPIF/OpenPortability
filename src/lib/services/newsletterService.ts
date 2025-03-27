import { ConsentType } from '../../hooks/useNewsLetter';

// Types
export interface NewsletterPreferencesData {
  email?: string;
  hqx_newsletter: boolean;
  oep_accepted: boolean;
  research_accepted: boolean;
  have_seen_newsletter: boolean;
  personalized_support: boolean;
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
    // Convertir les préférences en consentements
    const consents = [];
    if (typeof data.hqx_newsletter !== 'undefined') {
      consents.push({ type: 'email_newsletter', value: data.hqx_newsletter });
    }
    if (typeof data.oep_accepted !== 'undefined') {
      consents.push({ type: 'oep_newsletter', value: data.oep_accepted });
    }
    if (typeof data.research_accepted !== 'undefined') {
      consents.push({ type: 'research_participation', value: data.research_accepted });
    }
    if (typeof data.personalized_support !== 'undefined') {
      consents.push({ type: 'personalized_support', value: data.personalized_support });
    }

    // Update preferences using the /api/newsletter/request endpoint
    const response = await fetch('/api/newsletter/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        consents
      })
    });
    
    if (!response.ok) {
      console.error('Failed to update newsletter preferences');
      return false;
    }

    // Attendre que la réponse soit complètement traitée
    await response.json();
    
    return true;
  } catch (error) {
    console.error('Error updating newsletter preferences:', error);
    return false;
  }
};